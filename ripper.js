const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')
const fs = require('fs')

const { dbInit, dbAppData } = require('./db')
const { system } = require('./utils')

const { log, printLogo, logError } = require('./utils/log')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const application = require('./application/sync.js')

const init = async () => {

  // ensure ethers it the right version
  const version = ethers.version.split('/')[1].split('.')[0] //  ethers/5.7.2
  if (version !== '5') {
    log('Error: the version of ethers.js should be version 5.x.x', 1)
  }

  // dont run if another process is currently running (protects the db file from unscrupulous double writes)
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
  const blockHeight = await provider.getBlockNumber() 
  await dbInit.initPartitions(blockHeight) // ensure enough partitions to proceed
  await dbInit.assignPopularAddresses() // establish the contract cache
}

const interactiveMode = async () => {
  log('NOTICE: Entering Interactive Mode', 1)
  require('./application/cli')
}

const cleanup = (errorCode) => {
  log('NOTICE: Exiting', 4, system.memStats(false))
  process.exit(errorCode)
}

;(async () => {
  try {
    printLogo()
    await init()
    let found = false
    for (let i = 2; i < process.argv.length; i++) {
      if (process.argv[i] === 'cli' || process.argv[i] === 'i') {
        await interactiveMode()
        found = true
      }
    }
    if (!found) {
      await application.synchronize()
    }
    process.on('SIGHUP', () => { cleanup(0) })
    process.on('SIGINT', () => { cleanup(0) })
    process.on('SIGTERM', () => { cleanup(0) })
    if (!found) cleanup()
  } catch (error) {
    logError(error, 'Application Error')
    cleanup(1)
  }
})()
