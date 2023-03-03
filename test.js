const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')
const fs = require('fs')

const perf = require('execution-time')()
const { v4 } = require('uuid')

const { determineJobs, nextAvailableJob } = require('./jobs.js')
const { multiEth } = require('./utils')

const basepath = process.env.BASEPATH + 'derived/transactions/'
const checkDuplicates = false

// const externalProvider = new ethers.providers.InfuraProvider("homestead", 'b2473d5082fb481cb956714804b0b493')
const externalProvider = new ethers.providers.JsonRpcBatchProvider('https://rpc.coinsdo.com/eth', 1)

const sleep = (m) => {
  return new Promise(r => setTimeout(r, m))
}

const externalBlockInfo = async (block) => {
  const txns = await externalProvider.getBlock(block)
  const r = []
  for (let i = 0; i < txns.transactions.length; i++) {
    r.push(externalProvider.getTransactionReceipt(txns.transactions[i]))
  }
  const receipts = await Promise.all(r)
  console.log(receipts[0])
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
    console.log(block, txns.timestamp, receipt.transactionHash, txTargets)
    // await addTransaction(block, txns.timestamp, receipt.transactionHash, txTargets)
  }
}

;( async () => {

  // const txns = await externalProvider.getBlock(10572025)
  // console.log(txns)
  // process.exit(1)

  // await externalBlockInfo(10572025)

  // process.exit()

  const badBlockRanges = [
    [10572024, 10572050], 
    [10572058, 10572150], 
    [10572263, 10573150],
    [10864183, 10864300],
    [10864375, 10864492]
  ]

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


  // let block = 10572248 // tested untiil 10580000
  let block = 10864492 // tested until 10865966

  for (let i = 0; i < 10900000; i++) {
    if (inBadBlockRange(block) === false) {
      try {
        const txns = await multiEth.getProvider('mainnet').getBlock(Number(block))
        const receipts = await multiEth.getProvider('mainnet').send('erigon_getBlockReceiptsByBlockHash', [txns.hash])
        console.log('ok: ' + block)
      } catch (error) {
        console.log('Not ok: ' + block)
        await sleep(500)
      }
    }

    block += 1
  }

  process.exit()

  try {
    const lastBlock = await multiEth.getLastBlock('mainnet')
    console.log(lastBlock)
  } catch (error) {
    console.log(error)
  }

  const sortDir = (dirPath) => {
    const dir = fs.readdirSync(dirPath)
    let unsortedDirInts = []
    dir.forEach((f) => {
      if (f.includes('.json')) {
        unsortedDirInts.push(Number(f.replace('json', '')))
      }
    })
    const sortedDir = unsortedDirInts.sort((a, b) => { return a > b ? 1 : -1 })
    return sortedDir.map((n) => { return String(n) + '.json' })
  }

  /* 
    Determine if an array has duplicates
  */
  const hasDuplicates = (json) => {
    const hashes = []
    json.forEach((j) => {
      hashes.push(j.hash)
    })
    const hashSet = new Set(hashes)
    if (json.length !== hashSet.size) {
      return true
    }
  }

  /* 
    Continuity - evaluate empty or missing blocks
  */
  const checkContinuity = (json, key, path) => {
    // works for single file dirs, need to compare with all files to calc continuity.
    // Also need to identify missing blocks
    let counter = 0
    let lastBlock = json[0].block
    json.forEach((item, index) => {
      if (item.block !== lastBlock) {
        lastBlock += 1
        counter += 1
      }
    })
    const diff = 100000 - counter
    console.log('Job: ' + path + ' Counter: ' + counter + ' difference: ' + diff)
  }
  
  const lastBlock = await multiEth.getLastBlock('mainnet')

  const jobs = await determineJobs(lastBlock)
  for (key in jobs) {
    for (hth in jobs[key]) {
      // const skipto = Number(key) + Number(hth)
      // if (skipto !== 11100000) continue
      if (jobs[key][hth] === 'complete') {
        const dirPath = basepath + key + '/' + hth
        const sortedDir = sortDir(dirPath)
        for (let i = 0; i < sortedDir.length; i++) {
            const _json = fs.readFileSync(dirPath + '/' + sortedDir[i])
            const json = JSON.parse(_json)
          if (checkDuplicates) {
            if (hasDuplicates(json)) {
              console.log('Job: ' + dirPath + ' Duplicates were found.')
            } else {
              console.log('Job: ' + dirPath + ' Checking Duplicates: ' + (i + 1) + ' of ' + sortedDir.length)
            }
          }
          if (checkContinuity(json, key, dirPath)) {

          }
        }
      }
    }
  }
  // const all = v4()
  // perf.start(all)
  
  // await sleep(15000)

  // const allDuration = perf.stop(all)
  // console.log('Job ' + job.block + ' completed in ' + allDuration.preciseWords)

})()