const ethers = require('ethers')
const fs = require('fs')

const { jobTimer, txutils, dateutils } = require('../utils')
const { extractTopicsFromInputData } = txutils
const { start, stop, getId } = jobTimer
const { timeFmtDb, dateNowBKK } = dateutils
const router = require('./subscriptions/router.js')
const { log, logError } = require('../utils/log')
const { dbAppData } = require('../db')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const baseDir = process.env.BASEPATH + 'derived/tmp/'

const fileSizeMax = Number(process.env.JSON_TX_FILE_MAX) || 300000000
const confirmations = Number(process.env.CONFIRMATIONS) || 20
const useRam = process.env.OPTIMIZE_DISK_WRITES === 'true' ? true : false

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
  await dbAppData.setInt('last_block_scanned', block)
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

const commitMem = async (block) => {
  await dbAppData.setInt('last_block_scanned', block)
  if (txQueue.length === 0) return
  try { 
    
    const _json = JSON.stringify(txQueue)
    if (_json.length > fileSizeMax) {
      return { batchFinished: true, size: _json.length }
    }
  } catch (error) { 
    // this is fatal, for now
    console.log(error)
    console.log('DEBUG issue 5, reduce env - JSON_TX_FILE_MAX to 50000000')
    console.log(txQueue.length)
    process.exit()
  }

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
    try {
      txQueue = []
      const tmpFiles = await fs.readdirSync(baseDir) // get rid of any residual junk.
      for (let i = 0; i < tmpFiles.length; i++) {
        if (tmpFiles[i] === 'tmp.txt') continue
        log('rm: ' + baseDir + tmpFiles[i], 4)
        fs.rmSync(baseDir + tmpFiles[i])
      }
      const jobId = getId()
      log('NOTICE: Extracting block details from erigon, job: ' + jobId, 2)
      start('Extract Transactions')
      const syncFile = baseDir + jobId + '.json'
      fs.writeFileSync(syncFile, JSON.stringify([]))
      const startBlock = lastSyncPoint + 1
      let blocksProcessed = 0
      const theTop = blockHeight - confirmations
      let lastBlockProcessed
      let blockRef
      for (let block = startBlock; block <= theTop; block++) {
        lastBlockProcessed = block
        const txInfo = await module.exports.processBlock(block)
        if (txInfo.txCount > 0) {
          for (hash in txInfo.transactions) {
            addTransaction2Q(txInfo.block, txInfo.timestamp, hash, txInfo.transactions[hash])
          }
        }
        blocksProcessed += 1
        const commitEveryNBlocks = Number(process.env.COMMIT_EVERYN_BLOCKS) || 100
        if (blocksProcessed % commitEveryNBlocks === 0) {
          let result
          if (useRam) {
            result = await commitMem(block)
          } else {
            result = await commit(syncFile, block)
          }
          if (result && result.batchFinished === true) {
            log('Batch Finished % 100: ' + result.size + 'bytes', 2)
            return [jobId, txQueue]
          }
          const pause = await dbAppData.pauseStatus()
          if (pause) {
            log('NOTICE: >>>>>>> Extract batch: Pause flag detected <<<<<< Will Exit at end of this cycle.', 1)
            return [jobId, txQueue]
          }
        }
        blockRef = block
      }
      // If you passed this it means the project is inSync
      if (typeof lastBlockProcessed !== 'undefined') {
        if (useRam) {
          result = await commitMem(blockRef)
        } else {
          await commit(syncFile, lastBlockProcessed)
        }
      }
      stop('Extract Transactions', true)
      return [jobId, txQueue]
    } catch (error) {
      logError(error, 'Application Error in extractBatch')
      process.exit()
    }
  },

  processBlock: async (block) => {

    const blockInfo = await provider.getBlock(Number(block))
    let tb
    try {
      tb = await provider.send('trace_block', [Number(block)]) // error: insufficient funds for gas * price + va
    } catch (error) {
      log('WARNING: Couldnt bulk trace block, tracing individual transactions...')
      const _transactions = []
      for (let i = 0; i < blockInfo.transactions.length; i++) {
        try {
          const txTrace = await provider.send('trace_transaction', [blockInfo.transactions[i]])
          txTrace.forEach((action) => {
            _transactions.push(action)
          })
        } catch (error) {
          log('Found Untraceable transaction: ' + blockInfo.transactions[i])
        }
      }
      tb = _transactions
    }

    const [transactions, newContracts, parsedTrace] = extractTopicsFromInputData(tb)
    await router.data([transactions, newContracts, parsedTrace]) // call our external services here
    if (block % 200 === 0) {
      log('Block: ' + blockInfo.number + ': ' + timeFmtDb(Number(blockInfo.timestamp) * 1000) + ' tx: ' + Object.keys(transactions).length + ' newContracts: ' + newContracts.length, 2)
    }
    return {
      block: blockInfo.number,
      timestamp: blockInfo.timestamp,
      transactions: transactions, // Property containing Set
      txCount: Object.keys(transactions).length
    }
  }
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }