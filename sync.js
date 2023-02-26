const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')
const fs = require('fs')

const perf = require('execution-time')()
const { v4 } = require('uuid')

const { determineJobs, nextAvailableJob } = require('./jobs.js')

const { decimals, multiEth, signal, dateutils, utils} = require('./utils')
const { dbAddresses, dbTransactions } = require('./db')
const { getAddressInfo, addAddress, commitAddr } = dbAddresses
const { addTransaction, commitTxSync } = dbTransactions


const provider = multiEth.getProvider('mainnet')
const basepath = process.env.BASEPATH + '/derived/transactions/'

;(async () => {
  const lastBlock = await multiEth.getLastBlock('mainnet')
  const jobs = await determineJobs(lastBlock)
  const job = await nextAvailableJob(jobs)
  if (job === false) {
    console.log('No more jobs.')
    return
  }

  const all = v4()
  perf.start(all)
  console.log('Beginning Job: ', job.block)

  await makeJob(job)

  const allDuration = perf.stop(all)
  const message = 'Job ' + job.block + ' completed in ' + allDuration.preciseWords
  console.log(message)
  await signal.sendMessageToGroup(message, process.env.SIGNAL_GROUP_NOTIFICATIONS)

  process.exit(0)
})()

const makeJob = async (job) => {

  // mark this job as in progress
  const syncFile = basepath + job.mill + '/' + job.hth + '/sync'
  await fs.writeFileSync(syncFile, 'progress')
  const lowBlock = job.block
  const stop = lowBlock + 100000
  for (let block = lowBlock; block <= stop; block++) {
    const txns = await provider.getBlockWithTransactions(block)
    for (let i = 0; i < txns.transactions.length; i++) {
      const tx = txns.transactions[i]
      try {
        const addresses = []
        if (tx.from) addresses.push(tx.from.toLowerCase())
        if (tx.to) addresses.push(tx.to.toLowerCase())
        const receipt = await provider.getTransactionReceipt(tx.hash)
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
        await addTransaction(tx.blockNumber, txns.timestamp, tx.hash, txTargets)
      } catch (error) {
        console.log(tx)
        console.log(error)
      }
    }
    // commit every 1000 blocks or on stop, +1 is an attempt to resolve an indexing bug
    if (block + 1 % 1000 === 0 || block === stop) { 
      await commitTxSync(block)
    }
  }
  // mark job as complete
  await fs.writeFileSync(syncFile, 'complete')
  console.log('Job Complete:', job)
}

