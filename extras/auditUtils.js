const ethers = require('ethers')
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const { jobTimer, txutils } = require('../utils')
const { start, stop, getId } = jobTimer
const { log, logError } = require('../utils/log')
const { dbAppData, dbTransactions, dbTopic, dbCommon, dbContractCache } = require('../db')
const { processBlock } = require('../application/extractBatch')

module.exports = {
  auditRange: async (lowBlock, highBlock) => {
    console.log('Auditing Block Range from: ' + lowBlock + ' to: ' + highBlock)
    let reports = []
    for (let i = lowBlock; i < highBlock; i++ ) {
      const report = await module.exports.auditBlock(i, true)
      if (report.pass === false) {
        reports.push(i)
      }
      if (reports.length > 10) {
        console.log('There were more than ten bad blocks in this range. Here are the first ten issues:')
        reports.forEach(async (r) => {
          const result = await module.exports.auditBlock(r)
          console.log(result.acc)
          console.log('###############')
        })
        i = highBlock
      }
    }
    if (reports.length === 0) {
      console.log('There were no issues with the selected block range')
    } else {
      console.log('Found issues auditing the block range')
      reports.forEach(async (r) => {
        const result = await module.exports.auditBlock(r)
        console.log(result.acc)
        console.log('###############')
      })
    }
    console.log(reports)
    console.log()
    return
  },


  auditBlockNew: async (blockHeight, silence) => {

    const blockNode = await provider.getBlock(Number(blockHeight))
    const blockInfo = await await processBlock(blockHeight)
    if (blockNode.transactions.length !== blockInfo.txCount ||
      blockNode.transactions.length !== Object.keys(blockInfo.transactions).length) {
      // Node txns length dont match DB txs.
    }
    if (blockInfo.txCount == 0) {
      return { pass: true }
    }
    let pass = true
    for (hash in blockInfo.transactions) {
      const nodeSet = blockInfo.transactions[hash]
      const headers = await dbTransactions.getTransactionHeaders(hash)
      const topics = await dbTopic.getTopicsForParent(headers[0].id)
      if (headers.length > 1) {
        // found more than one transaction with matching hash.
        pass = false
      }
      if (nodeSet.size !== topics.length) {
        // 'WARNING: Arrays are not the same length.
        pass = false
      }
      topics.forEach((t) => {
        let found = false
        for (account of nodeSet) {
          if (t.account === account) {
            found = true
          }
        }
        if (!found) {
          // Couldnt find a matching transaction.
          pass = false
        }
      })

      if (!silence) console.log()
    }
    if (pass) {
      if (!silence) console.log('NOTICE: This block passed the tests')
      return { pass: true }
    } else {
      if (!silence) console.log('NOTICE: This block didnt pass the tests')
      return { pass: false }
    }
  },

  auditBlock: async (blockHeight) => {
    let acc = ''
    const blockNode = await provider.getBlock(Number(blockHeight))
    const blockInfo = await await processBlock(blockHeight)
    if (blockNode.transactions.length !== blockInfo.txCount ||
      blockNode.transactions.length !== Object.keys(blockInfo.transactions).length) {
      acc += 'WARNING: Node txns length dont match DB txs.\n'
    }
    acc += 'Audit Summary for block: ' + blockHeight + '\n'
    if (blockInfo.txCount == 0) {
      acc += 'There are no transactions to audit for this block.\n'
      return { pass: true }
    }
    let pass = true
    for (hash in blockInfo.transactions) {
      acc += '\n'

      const nodeSet = blockInfo.transactions[hash]
      acc += 'https://etherscan.io/tx/' + hash + '\n'
      acc += '  NodeInfo:\n'
      for (account of nodeSet) {
        acc += '    ' + account + '\n'
      }
      const headers = await dbTransactions.getTransactionHeaders(hash)
      const topics = await dbTopic.getTopicsForParent(headers[0].id)
      acc += '  Database Info:\n'
      topics.forEach((t) => {
        acc += '    ' + t.account + '\n'
      })

      if (headers.length > 1) {
        acc += 'WARNING: found more than one transaction with matching hash.\n'
        pass = false
      }
      if (nodeSet.size !== topics.length) {
        acc += 'WARNING: Arrays are not the same length.\n'
        pass = false
      }

      // Ensure that each topic is found among all accounts within the set 
      topics.forEach((t) => {
        let found = false
        for (account of nodeSet) {
          if (t.account === account) {
            found = true
          }
        }
        if (!found) {
          acc += 'WARNING: Couldnt find a matching transaction.\n'
          pass = false
        }
      })
      acc += '\n'
    }
    if (pass) {
      acc += 'NOTICE: This block passed the tests\n'
      return { pass: true, acc: acc }
    } else {
      acc += 'NOTICE: This block didnt pass the tests\n'
      return { pass: false, acc: acc }
    }
  }
}