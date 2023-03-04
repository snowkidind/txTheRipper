const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')
const fs = require('fs')

const perf = require('execution-time')()
const { v4 } = require('uuid')

const { determineJobs, nextAvailableJob, exitJob } = require('./jobs.js')
const { multiEth, signal, dateutils } = require('./utils')
const { timeFmtDb, dateNowBKK } = dateutils
const { dbTransactions } = require('./db')
const { addTransaction, commitTxSync, queueSize } = dbTransactions
const provider = multiEth.getProvider('mainnet')
const externalProvider = new ethers.providers.JsonRpcBatchProvider(process.env.EXTERNAL_NODE, 1)

const basepath = process.env.BASEPATH + '/derived/transactions/'
const applicationLog = process.env.BASEPATH + 'derived/application/log'
const pauseFile = process.env.BASEPATH + 'derived/application/pause'

const maxAcceptableLag = 2 // 1 second per rpc req and you are dead
let currentBlock

const badBlockRanges = [
  [10572024, 10572050],
  [10572058, 10572150],
  [10572263, 10573150],
  [10864183, 10864300],
  [10864375, 10864492]
]

; (async () => {
    let job, lastBlock
    try {
      lastBlock = await multiEth.getLastBlock('mainnet')
    } catch (error) {
      console.log(error)
      fs.writeFileSync(pauseFile, 'true')
      const message = 'Node doesnt appear to work. Quitting Job and Pausing: ' + JSON.stringify(error, null, 4)
      appLog(JSON.stringify(error, null, 4))
      await signal.sendMessageToGroup(message, process.env.SIGNAL_GROUP_NOTIFICATIONS)
      process.exit(1)
    }
    // process.exit()
    const jobs = await determineJobs(lastBlock)
    job = await nextAvailableJob(jobs, true)
    if (job === false) {
      console.log(timeFmtDb(dateNowBKK()) + ' No more jobs.')
      return
    }
    try {
      const all = v4()
      perf.start(all)
      console.log(timeFmtDb(dateNowBKK()) + ' Beginning Job: ', job.block)
      await makeJob(job, lastBlock)
      const allDuration = perf.stop(all)
      const message = 'Job ' + job.block + ' completed in ' + allDuration.preciseWords
      console.log(timeFmtDb(dateNowBKK()) + ' ' + message)
      await signal.sendMessageToGroup(message, process.env.SIGNAL_GROUP_NOTIFICATIONS)
    } catch (error) {
      await exitJob(job, true) // remove this job from the run file, pause on error
      appLog(JSON.stringify(error, null, 4))
      appLog('App crashed at Block: ' + currentBlock)
      await signal.sendMessageToGroup(JSON.stringify(error, null, 4), process.env.SIGNAL_GROUP_NOTIFICATIONS)
    }
    process.exit(0)
  })()

const inBadBlockRange = (block) => {
  let found = false
  badBlockRanges.forEach((r) => {
    [from, to] = r
    if (block > from && block < to) {
      console.log('Block ' + block + ' is in bad disk block range')
      found = true
    }
  })
  return found
}

const makeJob = async (job, lastBlock) => {

  // mark this job as in progress
  const syncFile = basepath + job.mill + '/' + job.hth + '/sync'
  const logFile = basepath + job.mill + '/' + job.hth + '/log'
  log(logFile, 'Beginning Job: ' + job.block)
  let lowBlock

  const doCommit = async (block) => {
    const q = queueSize()
    await commitTxSync(block)
    log(logFile, 'Commit at block: ', block)
    if (!responseCheck()) {
      const message = 'saving and quitting because the rpc is not responsive enough'
      log(logFile, message)
      await signal.sendMessageToGroup(message, process.env.SIGNAL_GROUP_NOTIFICATIONS)
      process.exit(1)
    }
    // console.log(timeFmtDb(dateNowBKK()) + ' commit: ' + block + ' transaction queue is: ' + q + ' bytes')
    log(logFile, 'commit: ' + block + ' txq: ' + q + ' bytes. job:' + job.block)
  }

  // if sync file says progress, read the dir and determine what block it is on and set lowBlock accordingly
  const status = fs.readFileSync(syncFile, 'utf8')
  if (status === 'progress') {
    const dirPath = basepath + job.mill + '/' + job.hth
    const dir = fs.readdirSync(dirPath)
    let highFile = 0
    dir.forEach((f) => {
      if (f.includes('.json')) {
        const height = Number(f.replace('.json', ''))
        if (height > highFile) {
          highFile = height
        }
      }
    })
    if (highFile) {
      const path = basepath + job.mill + '/' + job.hth + '/' + highFile + '.json'
      const jsonRaw = fs.readFileSync(path)
      const json = JSON.parse(jsonRaw)
      lowBlock = Number(json[json.length - 1].block) + 1
    } else {
      lowBlock = job.block + 1
    }
  } else {
    lowBlock = job.block
    await fs.writeFileSync(syncFile, 'progress')
  }
  let stop = Number(job.mill) + Number(job.hth) + 100000
  if (stop > lastBlock) {
    stop = lastBlock
  }

  log(logFile, 'Starting Job ' + job.block + ' from block: ' + lowBlock)

  let badBlockCommit = 0

  for (let block = lowBlock; block <= stop; block++) {
    currentBlock = block

    // In the case of a disk error you can optionally add a range of blocks to extract remotely
    if (inBadBlockRange(block) === true) {
      const externalInfo = await externalBlockInfo(block)
      for (let i = 0; i < externalInfo.length; i++) {
        const [b, timestamp, hash, targets] = externalInfo[i]
        await addTransaction(b, timestamp, hash, targets)
      }
      log(logFile, 'Adding ' + externalInfo.length + ' Transactions Bad Block info from external source')
      badBlockCommit += 1
      if (badBlockCommit > 5) {
        await doCommit(block) // commit after arduous processes more often to avoid redundant calls after api limit runout
        badBlockCommit = 0
      }
      continue
    }

    // if another process failed theres no reason this process should exit because of a bad request, so we retry on failure
    // if it throws a second time you get ejected from the building
    let txns
    try {
      txns = await provider.getBlock(Number(block))
    } catch {
      log(logFile, 'Taking a breather at getBlock ' + block)
      sleep(5000)
      txns = await provider.getBlock(Number(block))
    }
    let receipts
    try {
      receipts = await provider.send('erigon_getBlockReceiptsByBlockHash', [txns.hash])
    } catch (error) {
      log(logFile, 'Taking a breather at erigon_getBlockReceiptsByBlockHash ' + block)
      sleep(5000)
      receipts = await provider.send('erigon_getBlockReceiptsByBlockHash', [txns.hash])
    } 

    for (let i = 0; i < receipts.length; i++) {
      const receipt = receipts[i]
      const addresses = []
      if (receipt.from) addresses.push(receipt.from.toLowerCase())
      if (receipt.to) addresses.push(receipt.to.toLowerCase())
      for (let i = 0; i < receipt.logs.length; i++) {
        const l = receipt.logs[i]
        l.topics.forEach(t => {
          try {
            const decoded = ethers.utils.defaultAbiCoder.decode(['address'], t).toString()
            addresses.push(decoded.toLowerCase())
          } catch (error) {
          }
        })
      }
      const txTargets = new Set(addresses)
      // console.log(block, txns.timestamp, receipt.transactionHash, txTargets)
      await addTransaction(block, txns.timestamp, receipt.transactionHash, txTargets)
    }

    if (block % 10 === 0) log(logFile, 'Processed: ' + block + ' txns: ' + txns.transactions.length)

    // commit every 5Megs 1000 blocks or on stop, +1 is an attempt to resolve an indexing bug
    if (queueSize() > 5000000) {
      await doCommit(block)
    } else {
      if (block > 3000000) {
        if ((block + 1) % 500 === 0 || block === stop) {
          await doCommit(block)
        }
      } else {
        if ((block + 1) % 1000 === 0 || block === stop) {
          await doCommit(block)
        }
      }
    }
  }

  // mark job as complete
  await fs.writeFileSync(syncFile, 'complete')
  log(logFile, 'Job Complete:', job)
}

const responseCheck = async (block) => {
  const responseTest = v4()
  perf.start(responseTest)
  lastBlock = await provider.getBlockWithTransactions(block)
  const duration = perf.stop(responseTest)
  if (duration.time / 1000 > maxAcceptableLag) {
    return false
  }
  return true
}

const log = (logFile, message) => {
  let _message
  if (typeof message === 'object') {
    _message = timeFmtDb(dateNowBKK()) + ' ' + JSON.stringify(message) + '\n'
  } else {
    _message = timeFmtDb(dateNowBKK()) + ' ' + message + '\n'
  }
  fs.appendFileSync(logFile, _message)
}

const appLog = (message) => {
  let _message
  if (typeof message === 'object') {
    _message = timeFmtDb(dateNowBKK()) + ' ' + JSON.stringify(message) + '\n'
  } else {
    _message = timeFmtDb(dateNowBKK()) + ' ' + message + '\n'
  }
  fs.appendFileSync(applicationLog, _message)
}

const sleep = (m) => {
  return new Promise(r => setTimeout(r, m))
}

/* 
  When local data is unavailable, call upon external provider to extract information.
*/
const externalBlockInfo = async (block) => {
  const txns = await externalProvider.getBlock(block)
  const r = []
  for (let i = 0; i < txns.transactions.length; i++) {
    r.push(externalProvider.getTransactionReceipt(txns.transactions[i]))
  }
  const receipts = await Promise.all(r)
  const results = []
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i]
    const addresses = []
    if (receipt.from) addresses.push(receipt.from.toLowerCase())
    if (receipt.to) addresses.push(receipt.to.toLowerCase())
    for (let i = 0; i < receipt.logs.length; i++) {
      const l = receipt.logs[i]
      l.topics.forEach(t => {
        try {
          const decoded = ethers.utils.defaultAbiCoder.decode(['address'], t).toString()
          addresses.push(decoded.toLowerCase())
        } catch (error) {
        }
      })
    }
    const txTargets = new Set(addresses)
    results.push([block, txns.timestamp, receipt.transactionHash, txTargets])
  }
  return results
}
