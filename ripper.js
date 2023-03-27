const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')
const fs = require('fs')
const WebSocket = require('ws')

const { dbInit, dbAppData, dbContractCache } = require('./db')
const { system, events, jobTimer } = require('./utils')
const { start, stop, getId } = jobTimer
const { log, printLogo, logError } = require('./utils/log')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
let wsProvider
let kickstart = false // import downloaded data
let kickstartPath

const application = require('./application/sync.js')
const popularDir = process.env.BASEPATH + '/derived/popular/'
const subscriptionRouter = require('./application/subscriptions/router.js')

// Set up db variables on first and only first run
const initialInit = async () => {
  log('Initial Init. Welcome!', 1)
  await dbAppData.setInt('block_sync', 46146) // first ever eth transaction was in 46147
  await dbInit.initFunctions()
  await dbAppData.setBool('init', true)
  await dbAppData.setBool('working', false)
}

const echoSettings = () => {
  let settings = '\n\nApplication Settings:\n'
  settings += '    basepath:'.padEnd(30) + process.env.BASEPATH + '\n'
  settings += '    rpc:'.padEnd(30) + process.env.RPC_NODE + '\n'
  settings += '    rpcws:'.padEnd(30) + process.env.RPC_NODE_WS + '\n'
  settings += '    reconnect_timeout:'.padEnd(30) + process.env.WS_RECONNECT_TIMEOUT + '\n'
  settings += '    database_name:'.padEnd(30) + process.env.DB_NAME + '\n'
  settings += '    log_level:'.padEnd(30) + process.env.LOG_LEVEL + '\n'
  settings += '    log_to_file:'.padEnd(30) + process.env.LOG_TO_FILE + '\n'
  settings += '    log_to_file:'.padEnd(30) + process.env.LOG_FILE_LOCATION + '\n'
  settings += '    confirmations:'.padEnd(30) + process.env.CONFIRMATIONS + '\n'
  settings += '    optimize_disk_writes:'.padEnd(30) + process.env.OPTIMIZE_DISK_WRITES + '\n'
  settings += '    commit_every_n_blocks:'.padEnd(30) + process.env.COMMIT_EVERYN_BLOCKS + '\n'
  settings += '    json_file_max:'.padEnd(30) + process.env.JSON_TX_FILE_MAX + '\n'
  settings += '    use_multi_threads:'.padEnd(30) + process.env.USE_MULTI_THREADS + '\n'
  settings += '    number_of_threads:'.padEnd(30) + process.env.MULTI_THREADS + '\n'
  settings += '    index_cache_disable:'.padEnd(30) + process.env.INDEX_CACHE_DISABLE + '\n'
  settings += '    dont_index:'.padEnd(30) + process.env.DONT_INDEX + '\n'
  settings += '    sub_suspend_all:'.padEnd(30) + process.env.SUB_SUSPEND_ALL + '\n'
  settings += '    sub_use_unix_socket:'.padEnd(30) + process.env.SUB_USE_UNIX_SOCKET + '\n'
  settings += '    sub_unix_socket:'.padEnd(30) + process.env.SUB_UNIX_SOCKET + '\n'
  settings += '    sub_use_redis:'.padEnd(30) + process.env.SUB_USE_REDIS + '\n'
  settings += '    sub_type_account:'.padEnd(30) + process.env.SUB_TYPE_ACCOUNT + '\n'
  log(settings, 1)
}

// Set up db variables during normal operations
const init = async () => {

  echoSettings()

  // ensure ethers it the right version
  const version = ethers.version.split('/')[1].split('.')[0] //  ethers/5.7.2
  if (version !== '5') {
    log('Error: the version of ethers.js should be version 5.x.x', 1)
  }

  // dont run if another process is currently running
  const procDir = '/proc'
  const procStore = __dirname + '/derived/application/proc'
  if (fs.existsSync(procStore)) {
    const proc = await fs.readFileSync(procStore)
    if (fs.existsSync(procDir + '/' + proc)) {
      const procInfo = await fs.readFileSync(procDir + '/' + proc + '/status', 'utf8')
      const guts = procInfo.split('\n')
      if (guts[0].includes('node')) {
        await logStats(source)
        log('Error: Only one process may run at a time! Pid: ' + proc + ' is still running. Exiting...', 1)
        process.exit(1)
      }
    }
  }

  await fs.writeFileSync(procStore, String(process.pid))
  await dbInit.initTables() // ensure basic tables exist
  await dbInit.initApplicationDefaults()
  if (await dbAppData.getBool('init') !== true) { // must happen after table inits
    await initialInit()
  }

  const blockHeight = await provider.getBlockNumber() 
  await dbInit.initPartitions(blockHeight) // ensure enough partitions to proceed

  const indexCacheDisable = process.env.INDEX_CACHE_DISABLE || 'false'
  if (indexCacheDisable === 'false') {
    if (kickstart) {
      await kickstartCache(kickstartPath)
    }
    const accountsFile = popularDir + 'topAccts.json'
    let generate = false
    if (fs.existsSync(accountsFile)) { // double check there is at least an entry in accountsFile
      const _accounts = fs.readFileSync(accountsFile)
      let accounts = JSON.parse(_accounts)
      if (accounts.length === 0) {
        generate = true
      }
    } else { // the file doesnt exist at all
      generate = true
    }
    if (generate === true) {
      log('NOTICE: No popular Accounts file. This will be generated before proceeding.', 1)
      log('Please wait.  The process will be executed on a separate thread and will take around 10 - 15 minutes. See README.md.', 1)
      log('to check on progress, observe /derived/application/log', 1)
      await system.execCmd(process.env.EXEC_NODE + ' ' + process.env.BASEPATH + 'extras/popularContracts.js')
    }
    await dbInit.assignPopularAddresses() // establish the contract cache
  }
  if (kickstart) {
    await kickstartData(kickstartPath)
  }
  await subscriptionRouter.init()
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }

const interactiveMode = async () => {
  log('NOTICE: Entering Interactive Mode', 1)
  require('./application/cli')
}

const logStats = async (source) => {
  log(source + ' has finished', 1)
  system.memStats(true, 'Final System Memory Usage')
  stop('Main Application', true)
  log('NOTICE: Exit was clean. Marking Unpaused', 2)
}

let onlyOnce = false
const cleanup = async (errorCode) => {
  if (onlyOnce === true) return
  onlyOnce = true
  await dbAppData.markPaused()
  // Weve been told to quit but marking unpaused first
  const working = await dbAppData.getBool('working')
  if (working === true) {
    const source = await events.asyncListener('exit')
    if (source === 'finalize') {
      await logStats(source)
      await dbAppData.markUnPaused()
      process.exit(errorCode)
    } else {
      log('ERROR: Couldn\'t determine source of exit cmd', 4)
      process.exit(1)
    }
  } else {
    await logStats('local')
    await dbAppData.markUnPaused()
    process.exit(errorCode)
  }
}

const doSynchronize = async (block) => {
  let dont = false
  const lastSyncPoint = await dbAppData.getInt('block_sync')
  const diff = block - lastSyncPoint
  log('New Block:' + block + ' behind by: ' + diff + ' blocks', 1)
  const working = await dbAppData.getBool('working')
  if (working === false && dont === false) {
    const response = await application.synchronize(block)
    if (response === 'exit') {
      dont = true
      events.emitMessage('close', 'sync_complete')
    } else if (response === 'error') {
      logError('An Error occurred during this cycle. Will retry from last sync point.', 1)
    }
  }
}

const setUpWsProviderAndGo = async () => {
  if (wsProvider && wsProvider._websocket && 
    (wsProvider._websocket._readyState === WebSocket.OPEN || 
    wsProvider._websocket._readyState === WebSocket.CONNECTING)) {
    log('WebSocket already in use: ' + wsProvider._websocket._readyState, 1)
    return
  }
  wsProvider = new ethers.providers.WebSocketProvider(process.env.RPC_NODE_WS)
  const id = getId()
  wsProvider['ripperId'] = id
  log('NOTICE: Opening New WS Provider with id: ' + id)
  wsProvider.on("block", async (block) => {
    await doSynchronize(block)
  })
  const timeoutDuration = Number(process.env.WS_RECONNECT_TIMEOUT) * 1000 || 5000
  wsProvider._websocket.on("error", async (error) => {
    logError(error)
  })
  wsProvider._websocket.on("close", async (error) => {
    log('Websocket with id: ' + wsProvider.ripperId + ' was closed.')
    logError(error)
    log('NOTICE: >>>>>>> WEBSOCKET CLOSED <<<<<<', 1)
    setTimeout(async () => {
      await setUpWsProviderAndGo()
    }, timeoutDuration)
  })
} 


// Expectations: the sql file is not corrupt 
//               the file contains the exact amount of entries used to create chaindata
const kickstartCache = async (kickstartPath) => {
  const cacheAdded = dbAppData.getBool('kickstart:cache')
  if (cacheAdded === false) { // and not undefined
    log('kickstart: previously there was an error adding contract cache. Probably need to nuke and start over.', 1)
    process.exit(1)
  }
  const size = await dbContractCache.cacheSize() // nonzero chance that the user continues to set the flag
  if (size > 0) {
    log('kickstart: The contract cache was previously initialized.', 1)
    return
  }
  try {
    log('kickstart: initializing the index_cache', 1)
    await system.execCmd('psql -d ' + process.env.DB_NAME + ' -f ' + kickstartPath + '/index_cache.sql')
    await dbAppData.setBool('kickstart:cache', true)
  } catch (error) {
    await dbAppData.setBool('kickstart:cache', false)
    logError(error)
    log('The sql command to add the contract cache from the kickstart folder failed. Might need to nuke the db.')
  }
}

const kickstartData = async (kickstartPath) => {
  const kickstartedData = await dbAppData.getBool('kickstart:data')
  if (kickstartedData === true) {
    log('NOTICE: App has been successfully kickstarted. Please remove the kickstart arguments from the command line.')
    process.exit()
  }
  await dbAppData.setBool('kickstart:data', false)
  const dir = await fs.readdirSync(kickstartPath)
  const sorter = []
  let imported = await dbAppData.getInt('kickstart:import')
  if (typeof imported === 'undefined') imported = 0
  dir.forEach((file) => {
    if (file.includes('_blocks.sql')) {
      const fileNum = Number(file.replace('_blocks.sql', ''))
      if (fileNum > imported) {
        sorter.push(fileNum)
      }
    }
  })
  const sorted = sorter.sort((a, b) => { return a > b ? 1 : -1 })

  for (let i = 0; i < sorted.length; i++) {
    const file = kickstartPath + '/' + String(sorted[i]) + '_blocks.sql'
    try {
      log('Loading in kickstarter file: ' + file, 1)
      await system.execCmd('psql -d ' + process.env.DB_NAME + ' -f ' + file)
      await dbAppData.setInt('kickstart:import', sorted[i])
      await dbAppData.setInt('block_sync', sorted[i])
      await dbAppData.setInt('last_block_scanned', sorted[i])
      await sleep(500)
      if (i === sorted.length - 1) await dbAppData.setBool('kickstart:data', true)
    } catch (error) {
      logError(error)
      log('The sql command to add the transaction info from the kickstart folder failed. Might need to nuke the db.')
    }
  }
}

;(async () => {
  try {
    start('Main Application')
    printLogo()
    process.on('SIGHUP', async () => {
      log('NOTICE: >>>>>>> SIGHUP acknowledged <<<<<< Will Exit at end of this cycle.', 1)
      await cleanup(0)
    })
    process.on('SIGINT', async () => {
      log('NOTICE: >>>>>>> Ctl-C acknowledged <<<<<< Will Exit at end of this cycle. pId:' + process.pid, 1)
      await cleanup(0)
    })
    process.on('SIGTERM', async () => {
      log('NOTICE: >>>>>>> SIGTERM acknowledged <<<<<< Will Exit at end of this cycle.', 1)
      await cleanup(0)
    })
    let found = false
    for (let i = 2; i < process.argv.length; i++) {
      if (process.argv[i] === 'cli' || process.argv[i] === '-cli' || process.argv[i] === '--cli' || process.argv[i] === 'i') {
        found = true
      } else if (process.argv[i] === '--k' || process.argv[i] === '-k' || process.argv[i] === 'k') {
        // kickstart. it is expected that the database has not been initialized here
        if (typeof process.argv[i + 1] !== 'undefined') { 
          if (await fs.existsSync(process.argv[i + 1])) {
            const dir = await fs.readdirSync(process.argv[i + 1])
            if (dir.length > 2) {
              let checks = 0
              dir.forEach((file) => {
                if (file === 'index_cache.sql') checks += 1
                if (file.includes('_blocks.sql')) checks += 1
              })
              if (checks < 2) {
                log('Attempting to kickstart but the directory supplied did not pass the checks.', 1)
                log('There must be at minimum two files within: index_cache.sql and 0_blocks.sql', 1)
                process.exit(1)
              }
              const indexCacheDisable = process.env.INDEX_CACHE_DISABLE || 'false'
              if (indexCacheDisable === 'true') {
                log('In order to kickstart you must set .env.INDEX_CACHE_DISABLE=false', 1)
                process.exit(1)
              }
              kickstart = true
              kickstartPath = process.argv[i + 1]
            } else {
              log('Attempting to kickstart but the directory supplied does not appear to be valid.', 1)
              process.exit()
            }
          }
        }
      }
    }
    await init()
    log('NOTICE: Waiting for a block...', 1)
    const pause = await dbAppData.pauseStatus()
    if (pause) {
      log('NOTICE: >>>>>>> Main: Pause flag detected <<<<<< Entering interactive mode.', 1)
      found = true
    }
    events.emitter.on('close', async (source) => {
      if (source === 'sync_complete') {
        logStats(source)
        // log('NOTICE: ' + source + ' has finished, exiting', 4, system.memStats(false))
        await dbAppData.markUnPaused()
        process.exit(0)
      } else if (source === 'ws_error') {
        logError()
        logStats(source)
        // log('NOTICE: ' + source + ' has finished, exiting', 4, system.memStats(false))
        await dbAppData.markUnPaused()
        process.exit(0)
      }
    })
    if (found) {
      await interactiveMode()
    } else {
      await setUpWsProviderAndGo()
    } 
    // if (!found) await cleanup(0)
  } catch (error) {
    logError(error, 'Application Error')
    await cleanup(1)
  }
})()
