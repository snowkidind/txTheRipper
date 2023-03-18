const ethers = require('ethers')
const fs = require('fs')

const { jobTimer, txutils } = require('../utils')
const { extractTopicsFromInputData } = txutils
const { start, stop, getId } = jobTimer
const { log, logError } = require('../utils/log')
const { dbAppData } = require('../db')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const baseDir = process.env.BASEPATH + 'derived/tmp/'

const fileSizeMax = Number(process.env.JSON_TX_FILE_MAX) || 300000000
const confirmations = Number(process.env.CONFIRMATIONS) || 20

let txQueue = []

const addTransaction2Q = (block, timestamp, hash, topics) => {
  txQueue.push({
    block: block,
    timestamp: timestamp,
    hash: hash,
    topics: setToArray(topics)
  })
}

const commit = async (syncFile, block) => {
  if (txQueue.length === 0) return
  log('Commit: ' + txQueue.length + ' entries. Block: ' + block, 1)
  const dbRaw = await fs.readFileSync(syncFile)
  const db = JSON.parse(dbRaw)
  const newDb = [...db, ...txQueue]
  await fs.writeFileSync(syncFile, stringify(newDb))
  const stats = await fs.statSync(syncFile)
  if (stats.size > fileSizeMax) {
    return { batchFinished: true, size: stats.size }
  }
  txQueue = []
}

const stringify = (obj) => {
  let acc = '[\n'
  obj.forEach((obj) => { acc += '  ' + JSON.stringify(obj) + ',\n' })
  acc = acc.slice(0, acc.length - 2)
  acc += '\n]'
  return acc
}

const setToArray = (set) => {
  const arr = []
  set.forEach((item) => {
    arr.push(item)
  })
  return arr
}

module.exports = {

  /* 
    Build  JSON file that is no greater than 300 Megs, syncing regularly to maintain state.
    returns fileId

    blockHeight - the current height of the blockchain
    lastSyncPoint - the final block that was synced. Starts sync at lastSyncPoint + 1
  */

  extractBatch: async (blockHeight, lastSyncPoint) => {

    txQueue = []
    try {

      const tmpFiles = await fs.readdirSync(baseDir) // get rid of any residual junk.
      for (let i = 0; i < tmpFiles.length; i++) {
        console.log('rm: ' + baseDir + tmpFiles[i])
        fs.rmSync(baseDir + tmpFiles[i])
      }

      const jobId = getId()
      log('NOTICE: Extracting transaction details from node with id: ' + jobId, 2)
      start('Extract Transactions')
      const syncFile = baseDir + jobId + '.json'
      fs.writeFileSync(syncFile, JSON.stringify([]))
      const startBlock = lastSyncPoint + 1
      let blocksProcessed = 0
      const theTop = blockHeight - confirmations
      for (let block = startBlock; block <= theTop; block++) {

        const txInfo = await module.exports.processBlock(block)
        if (txInfo.txCount > 0) {
          for (hash in txInfo.transactions) {
            addTransaction2Q(txInfo.block, txInfo.timestamp, hash, txInfo.transactions[hash])
          }
        }
        blocksProcessed += 1
        const commitEveryNBlocks = Number(process.env.COMMIT_EVERYN_BLOCKS) || 100
        if (blocksProcessed % commitEveryNBlocks === 0) {

          const result = await commit(syncFile, block)
          if (result && result.batchFinished === true) {
            log('Batch Finished % 100: ' + result.size, 2)
            return jobId
          }

          const pause = await dbAppData.pauseStatus()
          if (pause) {
            log('NOTICE: >>>>>>> Pause flag detected <<<<<< Will Exit at end of this cycle.', 1)
            return jobId
          }
        }
      }
      // If you passed this it means the project is inSync
      await commit(syncFile, block)
      stop('Extract Transactions', true)
      return jobId
    } catch (error) {
      logError(error, 'Application Error in extractBatch')
    }
  },

  processBlock: async (block) => {
    const a = await provider.getBlock(Number(block))
    const b = provider.send('trace_block', [Number(block)])
    const [blockInfo, tb] = await Promise.all([a, b])
    const [transactions, newContracts] = extractTopicsFromInputData(tb)
    if (block % 200 === 0) {
      log('Block: ' + blockInfo.number + ' timestamp: ' + blockInfo.timestamp + ' tx: ' + Object.keys(transactions).length + ' newContracts: ' + newContracts.length, 2)
    }
    return {
      block: blockInfo.number,
      timestamp: blockInfo.timestamp,
      transactions: transactions, // Property containing Set
      txCount: Object.keys(transactions).length
    }
  }

}

