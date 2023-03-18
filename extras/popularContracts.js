const env = require('node-env-file')
env(__dirname + '/../.env')
const fs = require('fs')
const perf = require('execution-time')()
const { v4 } = require('uuid')
const ethers = require('ethers')
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)

process.env.LOG_TO_FILE = true
const { log, logError } = require('../utils/log')

const interval = 425000
const range = 240


/* 
  the intention of this script is to poll sections of the blockchain in order to discover 
  perpetually busy addresses. It takes 40 samplings of 240 consecutive blocks at intervals
  of 425000 blocks. The resultant set of addresses is then ranked and stored in a json file. 

  Upon running it took 13.9 minutes to execute at a block height of 16700000
*/

const decodeInputData = (inputData, verifyAddr) => {
  const chunks = inputData.substr(10).match(/.{1,64}/g) ?? []
  const results = []
  chunks.forEach((c) => {
    if (!c.startsWith('000000000000000000000000')) return // remove bytes inputs
    const ss = c.substr(24)
    if (ss.startsWith('00000000000000')) return // remove anything with a ton of zeroes at the front
    if (ss.length !== 40) return // remove any anomalies
    if (verifyAddr) { // Job completed in 16.702022 ms
      const isAddr = ethers.utils.isAddress('0x' + ss)
      if (isAddr) results.push('0x' + ss)
    } else { // Job completed in 1.465776 ms
      results.push('0x' + ss)
    }
  })
  return results
}

const extractTopicsFromInputData = (bt) => {
  let newContracts = []
  let txnsPre = {}
  bt.forEach((t) => { // prepopulate an object with transaction hashes
    if (!t.error && typeof t.transactionHash !== 'undefined') txnsPre[t.transactionHash] = []
    if (t.action.init && !t.error) {
      newContracts.push(t.result.address)
    } // annotate new contracts
  })
  bt.forEach((t) => { // add related transactions to respective hash
    if (!t.error && typeof t.transactionHash !== 'undefined') txnsPre[t.transactionHash].push(t)
  })
  let txns = {}
  for (hash in txnsPre) { // iterate groups of txs
    const group = txnsPre[hash]
    let inputFound = false
    let topics = []
    group.forEach((item) => {
      if (!inputFound) {
        if (item.action.input !== '0x' && typeof item.action.input !== 'undefined') {
          const inputTopics = decodeInputData(item.action.input, false)
          if (inputTopics.length > 0) {
            topics = [...topics, ...inputTopics]
            inputFound = true
          }
        }
      }
      topics.push(item.action.from)
      topics.push(item.action.to)
    })
    txns[hash] = new Set(topics)
  }
  return [txns, newContracts]
}

const addGeneration = (generation) => {
  let addresses = []
  for (let i = 0; i < generation.length; i++) {
    if (Object.keys(generation[i]).length > 0) {
      const txGroup = generation[i]
      for ( hash in txGroup ) {
        const acctGroup = txGroup[hash]
        acctGroup.forEach(account => {
          if (typeof account !== 'undefined') addresses.push(account)
        })
      }
    }
  }
  return addresses
}

const startPoints = (interval, stopAt) => {
  const points = []
  for (let i = 0; i < stopAt; i += interval) {
    if (i === 0) continue
    points.push(i)
  }
  return points
}

const popular = async (startPoint) => {
  log('Grabbing an hour of transactions starting from block: ' + startPoint, 1)
  const generation = []
  for (let block = startPoint; block < (startPoint + range); block++ ){
    const trace = await provider.send('trace_block', [block])
    const [ topics ] = extractTopicsFromInputData(trace)
    generation.push(topics)
  }
  return generation
}

const arrayify = (obj) => {
  const arr = []
  for (item in obj) {
    arr.push({ account: item, count: obj[item] })
  }
  return arr
}

const countDuplicates = (generations) => {
  const accounts = {}
  for (let i = 0; i < generations.length; i++) {
    for (let j = 0; j < generations[i].length; j++) {
      if (!accounts[generations[i][j]]) accounts[generations[i][j]] = 1
      else accounts[generations[i][j]] = accounts[generations[i][j]] + 1
    } 
  }
  let acctsArr = arrayify(accounts)
  acctsArr = acctsArr.sort(( a, b ) => { return a.count > b.count ? -1 : 1 })
  return acctsArr
}

  ; (async () => {
    try {
      log('NOTICE: Generating commonly used addresses', 1)

      const generations = []
      const height = await provider.getBlockNumber()

      const all = v4()
      perf.start(all)

      const points = startPoints(interval, height)
      for (let i = 0; i < points.length; i++) {
        const generation = await popular(points[i])
        generations.push(addGeneration(generation))
      }

      const accts = countDuplicates(generations)
      fs.writeFileSync(process.env.BASEPATH + '/derived/popular/topAccts.json', JSON.stringify(accts, null, 4))
      
      const allDuration = perf.stop(all)
      log('Common address generation job completed in ' + allDuration.preciseWords, 1)

    } catch (error) {
      logError(error)
    }
    process.exit(0)
  })()