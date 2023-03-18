const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')
const fs = require('fs')

const { dbInit, dbAppData } = require('./db')
const { system, events } = require('./utils')

const { log, printLogo, logError } = require('./utils/log')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const application = require('./application/sync.js')
const popularDir = process.env.BASEPATH + '/derived/popular/'

const initialInit = async () => {
  log('Initial Init. Welcome!', 1)
  await dbAppData.setLastBlockSynced(46146) // first ever eth transaction was in 46147
  await dbAppData.setBool('init', true)
}

const init = async () => {

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
  }
  await dbInit.assignPopularAddresses() // establish the contract cache
}

const interactiveMode = async () => {
  log('NOTICE: Entering Interactive Mode', 1)
  require('./application/cli')
}

const cleanup = async (errorCode) => {
  return new Promise (async (resolve) => {
    events.emitter.on('close', async (source) => {
      log(source + ' has finished', 1)
      log('NOTICE: Exiting', 4, system.memStats(false))
      log('NOTICE: Marking Unpaused', 2)
      await dbAppData.markUnPaused()
      process.exit(errorCode)
    })
    await dbAppData.markPaused()
  })
}


;(async () => {
  try {
    printLogo()

    process.on('SIGHUP', async () => {
      log('NOTICE: >>>>>>> SIGHUP acknowledged <<<<<< Will Exit at end of this cycle.', 1)
      await cleanup(0)
    })
    process.on('SIGINT', async () => {
      log('NOTICE: >>>>>>> Ctl-C acknowledged <<<<<< Will Exit at end of this cycle.', 1)
      await cleanup(0)
    })
    process.on('SIGTERM', async () => {
      log('NOTICE: >>>>>>> SIGTERM acknowledged <<<<<< Will Exit at end of this cycle.', 1)
      await cleanup(0)
    })

    let found = false
    for (let i = 2; i < process.argv.length; i++) {
      if (process.argv[i] === 'cli' || process.argv[i] === 'i') {
        found = true
      }
    }
    await init()
    if (found) {
      await interactiveMode()
    } else {
      await application.synchronize()
    }
    
    if (!found) cleanup()
  } catch (error) {
    logError(error, 'Application Error')
    await cleanup(1)
  }
})()
