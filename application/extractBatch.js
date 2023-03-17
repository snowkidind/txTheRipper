const ethers = require('ethers')
const fs = require('fs')

const { jobTimer, txutils, events } = require('../utils')
const { extractTopicsFromInputData } = txutils
const { start, stop, getId } = jobTimer
const { log, logError } = require('../utils/log')
const { dbAppData } = require('../db')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const baseDir = process.env.BASEPATH + 'derived/tmp/'

const fileSizeMax = Numner(process.env.JSON_TX_FILE_MAX) || 300000000
const confirmations = Number(process.env.CONFIRMATIONS) || 20

let txQueue = []

const readline = require('node:readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

process.stdin.setRawMode(true);
process.stdin.on("keypress", async function (chunk, key) {
  if (key && key.name === "c" && key.ctrl) {
    log('\n\n\n\n\n', 1)
    log('Ctl C Detected. Unwinding...', 1)
    log('\n\n\n\n\n', 1)
    await dbAppData.markPaused()
  }
})

// Once ctl-c has been selected this is overridden.
events.emitter.on('cmd', async (cmd) => {
  if (cmd.text === 'p'){
    await dbAppData.markPaused()
  } else {
    console.log('Something Happened: ')
    console.log(cmd)
    console.log()
  }
})

rl.on('line', (line) => {
  events.emitMessage('cmd', { text: line })
})


const addTransaction2Q = (block, timestamp, hash, topics) => {
  txQueue.push({
    block: block,
    timestamp: timestamp,
    hash: hash,
    topics: setToArray(topics)
  })
}

const commit = async (syncFile) => {
  if (txQueue.length === 0) return
  log('Commit: ' + txQueue.length + ' entries. ', 2)
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

const processBlock = async (block) => {
  const a = await provider.getBlock(block)
  const b = provider.send('trace_block', [block])
  const [blockInfo, tb] = await Promise.all([a, b])
  const [transactions, newContracts] = extractTopicsFromInputData(tb)
  if (block % 10 === 0) {
    log('Block: ' + blockInfo.number + ' timestamp: ' + blockInfo.timestamp + ' tx: ' + Object.keys(transactions).length + ' newContracts: ' + newContracts.length, 1)
  }
  return { 
    block: blockInfo.number, 
    timestamp: blockInfo.timestamp, 
    transactions: transactions, // Property containing Set
    txCount: Object.keys(transactions).length }
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

        const txInfo = await processBlock(block)
        if (txInfo.txCount > 0) {
          for (hash in txInfo.transactions) { 
            addTransaction2Q(txInfo.block, txInfo.timestamp, hash, txInfo.transactions[hash])
          }
        }
        blocksProcessed += 1
        const commitEveryNBlocks = Number(process.env.COMMIT_EVERYN_BLOCKS) || 100
        if (blocksProcessed % commitEveryNBlocks === 0) {
          
          const result = await commit(syncFile)
          if (result && result.batchFinished === true) {
            log('Batch Finished % 100: ' + result.size, 2)
            return jobId
          }

          const pause = await dbAppData.pauseStatus()
          if (pause) {
            log('Pause flag detected.', 1)
            return jobId
          }
        }
      }
      // If you passed this it means the project is inSync
      await commit(syncFile)
      stop('Extract Transactions', true)
      return jobId
    } catch (error) {
      logError(error, 'Application Error in extractBatch')
    }
  }
}

