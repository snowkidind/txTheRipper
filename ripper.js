const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')

const { dbInit } = require('./db')
const { system } = require('./utils')
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const application = require('./application/sync.js')

const init = async () => {
  await dbInit.initTables() // ensure basic tables exist
  await dbInit.initApplicationDefaults()
  const blockHeight = await provider.getBlockNumber() 
  await dbInit.initPartitions(blockHeight) // ensure enough partitions to proceed
  await dbInit.assignPopularAddresses() // establish the contract cache
}

const interactiveMode = async () => {
  console.log('NOTICE: Entering Interactive Mode')
  require('./application/cli')
}

const cleanup = (errorCode) => {
  console.log('NOTICE: Exiting')
  system.memStats(true)
  process.exit(errorCode)
}

;(async () => {
  try {

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
    console.log(error)
    cleanup(1)
  }
})()
