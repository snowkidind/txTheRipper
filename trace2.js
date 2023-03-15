const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')

const { multiEth, decimals, dateutils } = require('./utils')
const { epochFromDate, dateNowBKK } = dateutils
const { d } = decimals
const provider = multiEth.getProvider('mainnet')
const { dbRedis } = require('./db')
const perf = require('execution-time')()
const { v4 } = require('uuid')

const erc20 = require('./data/erc20.json')

// optionally generate a table that indexes addresses by contract or EOA
const getContracts = true

// Amount of contractAddresses to cache in redis (this affects processing time vs disk access)
const accountCacheLength = 10000

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


/* 
  this uses redis to maintain a cache of accountCacheLength to 
  reduce the number of calls to getCode() this allows us to balance
  cpu cycles with disc access
*/
const findContracts = async (topics) => {
  const _accountCache = await dbRedis.get('ripper:accountCache')
  let accountCache = []
  if (_accountCache) accountCache = JSON.parse(_accountCache)

  let calls = 0
  const exists = (account, accountCache) => {
    for (let i = 0; i < accountCache.length; i++) {
      if (account == accountCache[i][0]) {
        return true
      }
    }
    return false
  }
  const len = Object.keys(accountCache).length
  const time = epochFromDate(dateNowBKK())
  const contracts = []
  for (const t of topics.values()) {
    if (exists(t, accountCache) === true) {
      continue
    }
    calls += 1
    const code = await provider.getCode(t)
    if (code !== '0x') {
      contracts.push(t)
    }
    accountCache.push([t, time])
  }
  if (len > accountCacheLength) {
    accountCache = accountCache.sort((a, b) => { return a[1] > b[1] ? 1 : -1 })
    accountCache = accountCache.slice(0, accountCacheLength)
  }
  await dbRedis.set('ripper:accountCache', JSON.stringify(accountCache))
  return [contracts, calls]
}

const processBlock = async (block) => {
  const a = await provider.getBlock(block)
  const b = provider.send('trace_block', [block])
  const [blockInfo, tb] = await Promise.all([a, b])
  const [topics, newContracts] = extractTopicsFromInputData(tb)
  console.log('Block: ' + blockInfo.number + ' timestamp: ' + blockInfo.timestamp + ' tx: ' + Object.keys(topics).length + ' newContracts: ' + newContracts.length)
}

  ; (async () => {
    try {

      const all = v4()
      perf.start(all)

      for (let i = 12000011; i < 12000015; i++) {
        await processBlock(i)
      }

      const allDuration = perf.stop(all)
      console.log('Block info extracted in ' + allDuration.preciseWords)

    } catch (error) {
      console.log(error)
    }
    process.exit()
  })()


  // Range of 30 Blocks
  // 2000 Block info extracted in 10.5453821 s
  // 1000 11.186035041 s
  // 10000 10.154621128 s

    // Range of 100 Blocks
  // 2000 Block info extracted in 1.3166666666666667 min
  // 1000  1.8166666666666667 min
  // 10000 1.1666666666666667 min
