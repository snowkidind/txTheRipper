const env = require('node-env-file')
env(__dirname + '/../.env')
const fs = require('fs')
const perf = require('execution-time')()
const { v4 } = require('uuid')
const { EVM } = require('evm')
const axios = require('axios')
const ethers = require('ethers')
const { dbRedis } = require('../db')
const { getAbi } = require('./utils/getAbi.js')
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const popularFile = require('../derived/popular/topAccts.json')
const erc20Abi = require('./utils/erc20.json')

/* 
  the purpose of this script is to identify Titles on accounts for 
  a list of "popular" accounts. (see ../derived/popular/topAccts.json)
  
  Iterating this file, it tests to see if it is a contract and attempts
  to get a symbol. Upon failure of that it attempts to pull a contracts abi off of etherscan
  to get contract info. Upon EOA or Any failure it then scrapes the title out of the etherscan page.

  There are several things in place to remove redundant requests to etherscan but also since 
  this scrapes info from etherscan for which there is no endpoint it is better to do it slow

  Redundant runs of the script begin where it left off but the full scrapes and abi's are 
  saved for future use.

  About Sources:
    EA Ehterscan Abi
    ES Etherscan Scrape
    EC Etherscan Cached Abi
    CA Cached Abi (no source)
    CS Cached Scrape
    D Unknown (Default)
    N Node

*/

// Remember which entries had no abi 
const noabiCacheFile = process.env.BASEPATH + 'derived/application/noabi.json'
let noabiCache = []
const printEtherscanRequests = false

const scrapeEtherscan = async (account, defaultId) => {
  let source = ''
  const localFile = process.env.BASEPATH + 'derived/scrape/' + account + '.html'
  let file
  if (fs.existsSync(localFile)) {
    file = fs.readFileSync(localFile, 'utf8')
    source = 'CS'
  } else {

    // Dont send a request more often than every request_rate seconds
    // NOTE This is still ineffective if other scripts dont use the same key
    const request_rate = process.env.ETHERSCAN_REQ_RATE || 2
    const key = "multiEth:etherscan_rate_limit"
    const limit = await dbRedis.get(key)
    if (!limit) {
      await sleep(request_rate * 1000)
    }
    dbRedis.set(key, request_rate, request_rate)
    const url = 'https://etherscan.io/address/' + account
    if (printEtherscanRequests) console.log('GET: ' + url + ' --scrape')
    const _file = await axios.get(url)
    file = _file.data
    fs.writeFileSync(localFile, file)
    source = 'ES'
  }
  const lines = file.split('\n')
  let title = ''
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<title>')) {
      try {
        title += lines[i + 1].split('|')[0].trim()
      } catch (error) {
        console.log('Couldnt extract title')
      }
    }
  }
  if (title === '') {
    title = defaultId
    source = 'D'
  }
  return [title, source ]
}


const getAccountInfo = async (account) => {
  const code = await provider.getCode(account)

  // If its an EOA we are interested in who it is; scrape
  if (code === '0x') {
    return await scrapeEtherscan(account, 'EOA')
  }

  // If its a contract we can try and extract the symbol using only the node. if gibberish: scrape
  const contract = new ethers.Contract(account, erc20Abi, provider)
  const keys = new EVM(code) // generates a list of available functions from the code
  let found = false
  keys.getFunctions().forEach((f) => {
    if (f === 'symbol') {
      found = true
    }
  })
  if (found) {
    try {
      let symbol = await contract.symbol()
      symbol = symbol.toString() // assume its a string
      if (symbol.startsWith('0x')) symbol = hex2a(symbol)
      if (typeof symbol === 'string' && symbol.length === 0) {
        return await scrapeEtherscan(account, 'UNKNOWN')
      }
      return [symbol, 'N']
    } catch (e) {
      console.log(account, e, code)
    }
  }

  // If still no symbol, we need etherscan to do the ID so the rest exists to abide by their rules
  //   In order to idempotently run the script we need to store failed calls to get abi.
  //   This expedites the process when run more than once
  let abi, abiSource
  const notDed = await dbRedis.get('ripper:popular:noabi:' + account) // if key exists, address failed abi retrieval
  if (!notDed) {
    const cached = false
    noabiCache.forEach((act) => {
      if (account === act) {
        cached = true
      }
    })
    if (!cached) {
      // NOTE sometimes while an abi is received we still dont know what it is
      //    therefore a scrape can also occur after an abi request suceeds
      const [_abi, _abiSource] = await getAbi(account, 'mainnet', printEtherscanRequests) // no key, ok to call
      abi = _abi
      abiSource = _abiSource
      if (typeof abi === 'undefined') {
        // record that the abi was unavailable
        noabiCache.push(account)
        fs.writeFileSync(noabiCacheFile, JSON.stringify(noabiCache, null, 4))
      }
    }
  }

  // If unable to get the abi at all, scrape
  if (!abi) {
    await dbRedis.set('ripper:popular:noabi:' + account, 2592000) // no abi mark as failed, invalid after 30d
    return await scrapeEtherscan(account, 'UNVERIFIED')
  }

  // If abi has a symbol call, try that to get symbol for the contract, if gibberish: scrape
  let hasSymbol = false
  abi.forEach((item) => {
    if (item.name === 'symbol') {
      hasSymbol = true
    }
  })
  if (hasSymbol) {
    const contract = new ethers.Contract(account, abi, provider)
    let symbol = await contract.symbol()
    symbol = symbol.toString() // assune its a string
    if (symbol.startsWith('0x')) symbol = hex2a(symbol)
    if (typeof symbol === 'string' && symbol.length === 0) {
      return await scrapeEtherscan(account, 'UNKNOWN')
    }
    return [symbol, abiSource]
  }

  // If abi is received yet still cannot determine who it is, scrape
  return await scrapeEtherscan(account, 'NOID')

}

function hex2a(hexx) {
  const hex = hexx.toString()
  let str = ''
  for (var i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  return str
}

const main = async () => {

  if (!fs.existsSync(noabiCacheFile)) fs.writeFileSync(noabiCacheFile, '[]')
  const _noabiCache = fs.readFileSync(noabiCacheFile)
  noabiCache = JSON.parse(_noabiCache)

  for (let i = 0; i < popularFile.length; i++) {
    if (popularFile[i].count > 9) {
      const [name, source] = await getAccountInfo(popularFile[i].account)
      console.log(String(i + ':').padEnd(7) + popularFile[i].account + ' ' + source.padEnd(3) + name)
      // TODO collect for output and generate sql file
    }
  }
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }

  ; (async () => {
    try {
      await main()
    } catch (error) {
      console.log('Application Error')
      console.log(error)
    }
    process.exit()
  })()