const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')

const { determineJobs, nextAvailableJob } = require('./jobs.js')

const { multiEth, dateutils } = require('./utils')
const { timeFmtDb, dateNowBKK } = dateutils
const provider = multiEth.getProvider('mainnet')
const ws = multiEth.getWebSocket()

const perf = require('execution-time')()
const { v4 } = require('uuid')

let logFile
let useWs = true

const maxAcceptableLag = 1 // 1 second per rpc req and you are dead

const main = async () => {

  const lastBlock = await multiEth.getLastBlock('mainnet')
  const jobs = await determineJobs(lastBlock)
  const job = await nextAvailableJob(jobs)
  if (job === false) {
    console.log(timeFmtDb(dateNowBKK()) + ' No more jobs.')
    return
  }

  const all = v4()
  perf.start(all)
  console.log(timeFmtDb(dateNowBKK()) + ' Beginning Job: ', job.block)

  await makeJob(job)

  const allDuration = perf.stop(all)
  const message = 'Job ' + job.block + ' completed in ' + allDuration.preciseWords
  console.log(timeFmtDb(dateNowBKK()) + ' ' + message)

}

  ;( async () => {
    console.log('Using Websocket')    
    await main()
    useWs = false
    console.log('Using Rest')  
    await main()

  })()

const makeJob = async (job) => {

  const lowBlock = job.block
  const stop = lowBlock + 500
  for (let block = lowBlock; block <= stop; block++) {
    let txns
    if (useWs) {
      txns = await ws.getBlockWithTransactions(block)
    } else {
      txns = await provider.getBlockWithTransactions(block)
    }
    for (let i = 0; i < txns.transactions.length; i++) {
      const tx = txns.transactions[i]
      try {
        const addresses = []
        if (tx.from) addresses.push(tx.from.toLowerCase())
        if (tx.to) addresses.push(tx.to.toLowerCase())
        let receipt
        if (useWs) {
          receipt = await ws.getTransactionReceipt(tx.hash)
        } else {
          receipt = await provider.getTransactionReceipt(tx.hash)
        }

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
      } catch (error) {
        console.log(tx)
        console.log(error)
        log(logFile, error)
      }
    } 
    if (block % 100 === 0) {
      console.log(block)

      const responseTest = v4()
      perf.start(responseTest)

      if (useWs) {
        lastBlock = await ws.getBlockWithTransactions(block)
      } else {
        lastBlock = await ws.getBlockWithTransactions(block)
      }
      const duration = perf.stop(responseTest)
      if (duration.time /  1000 > maxAcceptableLag) {
        console.log('saving and quitting because the rpc is not responsive enough.')
      }
    
    }
  }
}

const log = (_, message) => {
  console.log(message)
}