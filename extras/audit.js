const env = require('node-env-file')
env(__dirname + '/../.env')
const ethers = require('ethers')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)

const { jobTimer, txutils } = require('../utils')
const { start, stop, getId } = jobTimer
const { log, logError } = require('../utils/log')
const { dbAppData, dbTransactions, dbTopic, dbCommon, dbContractCache } = require('../db')
const { processBlock } = require('../application/extractBatch')
const { auditBlock } = require('./auditUtils.js')

/* 
  Audit.js:

  Pick random blocks in the database and ensure the linked data is accurate to the chaindata

*/
const noIndexMax = 4000000



;(async () => {

  try {

    let highBlock = await dbAppData.getInt('block_sync')
    log('Application is synced to block height: ' + highBlock, 1)
    if (process.argv.length > 2) {
      if (process.argv[2] < highBlock) {
        highBlock = process.argv[2]
      } else {
        console.log('Couldn\'t interpret request, using last block synced: ' + highBlock)
      }
    }

    start('Audit')
    let noIndexes = false
    const indexesTx = await dbCommon.showIndexes('transactions')
    const indexesT = await dbCommon.showIndexes('topic')
    if (indexesTx.length === 0 || indexesT.length === 0) {
      log('Indexing is not complete. You should wait until the indexing is added to run a complete audit', 1)
      noIndexes = true
    }
    
    if (highBlock > noIndexMax && noIndexes) {
      let message = '\n\nERROR: Block sync is above ' + noIndexMax + ': currently: ' + highBlock + '\n'
      message += 'Without indexing, database queries for this test will take too long to complete.\n'
      message += 'Exiting. Come back later...\n'
      log(message, 1)
      process.exit(1)
    }

    await auditBlock(highBlock)

    stop('Audit', true)
  } catch (error) {
    logError(error, 'Application Error')
  }
  process.exit()
})()