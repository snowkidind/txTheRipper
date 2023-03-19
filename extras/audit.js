const env = require('node-env-file')
env(__dirname + '/../.env')
const ethers = require('ethers')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)

const { jobTimer, txutils } = require('../utils')
const { start, stop, getId } = jobTimer
const { log, logError } = require('../utils/log')
const { dbAppData, dbTransactions, dbTopic, dbCommon, dbContractCache } = require('../db')
const { processBlock } = require('../application/extractBatch')

/* 
  Audit.js:

  Pick random blocks in the database and ensure the linked data is accurate to the chaindata

*/
const noIndexMax = 4000000

const auditBlock = async (blockHeight) => {
  const blockNode = await provider.getBlock(Number(blockHeight))
  const blockInfo = await await processBlock(blockHeight)
  if (blockNode.transactions.length !== blockInfo.txCount ||
    blockNode.transactions.length !== Object.keys(blockInfo.transactions).length) {
    console.log('WARNING: Node txns length dont match DB txs.')
  }
  console.log('\nAudit Summary for block: ' + blockHeight)
  if (blockInfo.txCount == 0) {
    console.log('There are no transactions to audit for this block.')
    return
  }
  let pass = true
  for (hash in blockInfo.transactions) {
    console.log()
    const nodeSet = blockInfo.transactions[hash]
    console.log('https://etherscan.io/tx/' + hash)
    console.log('\n  NodeInfo:')
    for (account of nodeSet) {
      console.log('    ' + account)
    }
    console.log()
    const headers = await dbTransactions.getTransactionHeaders(hash)
    const topics = await dbTopic.getTopicsForParent(headers[0].id)
    console.log('  Database Info:')
    topics.forEach((t) => {
      console.log('    ' + t.account)
    })
    if (headers.length > 1) {
      console.log('WARNING: found more than one transaction with matching hash.')
      pass = false
    }
    if (nodeSet.size !== topics.length) {
      console.log('WARNING: Arrays are not the same length.')
      pass = false
    }
    topics.forEach((t) => {
      let found = false
      for (account of nodeSet) {
        if (t.account !== account) {
          found = true
        }
      }
      if (!found) {
        console.log('WARNING: Couldnt find a matching transaction.')
        pass = false
      }
    })

    console.log()
  }
  if (pass) {
    console.log('NOTICE: This block passed the tests')
  } else {
    console.log('NOTICE: This block didnt pass the tests')
  }
}


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