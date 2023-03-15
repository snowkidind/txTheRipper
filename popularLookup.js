const env = require('node-env-file')
env(__dirname + '/.env')
const fs = require('fs')
const perf = require('execution-time')()
const { v4 } = require('uuid')
const { EVM } = require('evm')
const axios = require('axios')
const ethers = require('ethers')
const { dbRedis } = require('./db')
const { multiEth } = require('./utils')
const provider = multiEth.getProvider('mainnet')
const popularFile = require('./derived/popular/topAccts.json')
const erc20Abi = require('./data/erc20.json')

/* 
  the purpose of this script is to identify Titles on accounts for 
  a list of "popular" accounts. (see ./derived/popular/topAccts.json)
  
  Iterating this file, it tests to see if it is a contract and attempts
  to get a symbol. Upon failure of that it attempts to pull a contracts abi off of etherscan
  to get contract info. Upon EOA or Any failure it then scrapes the title out of the etherscan page.

  There are several things in place to remove redundant requests to etherscan but also since 
  this scrapes info from etherscan for which there is no endpoint it is better to do it slow

  Redundant runs of the script begin where it left off but the full scrapes and abi's are 
  saved for future use.
*/

const scrapeRestingPeriod = 40000

const scrapeEtherscan = async (account, defaultId) => {
  const localFile = __dirname + '/derived/scrape/' + account + '.html'
  let file
  if (fs.existsSync(localFile)) {
    file = fs.readFileSync(localFile, 'utf8')
  } else {
    // console.log('Alligator Crawl: ' + account)
    await sleep(scrapeRestingPeriod) // casually crawl
    const url = 'https://etherscan.io/address/' + account
    const _file = await axios.get(url)
    file = _file.data
    fs.writeFileSync(localFile, file)
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
  if (title === '') title = defaultId
  return title
}

const getAccountInfo = async (account) => {
  const code = await provider.getCode(account)
  if (code === '0x') { 
    await scrapeEtherscan(account, 'EOA') 
  }
  const contract = new ethers.Contract(account, erc20Abi, provider)
  let symbol
  try { symbol = await contract.symbol() } catch (e) {}
  if (!symbol) {
    let abi 
    const notDed = await dbRedis.get('ripper:popular:noabi:' + account) // if key exists, address failed abi retrieval
    if (!notDed) {
      abi = await multiEth.getAbi(account) // no key, ok to call
    }
    if (!abi) {
      await dbRedis.set('ripper:popular:noabi:' + account, 2592000) // no abi mark as failed, invalid after 30d
      const title = await scrapeEtherscan(account, 'UNVERIFIED')
      return title
    }
    let hasSymbol = false
    abi.forEach((item) => {
      if (item.name === 'symbol') {
        hasSymbol = true        
      }
    })
    if (hasSymbol) {
      const contract = new ethers.Contract(account, abi, provider)
      let symbol = await contract.symbol()
      if (symbol.startsWith('0x')) symbol = hex2a(symbol)
      if (typeof symbol === 'string' && symbol.length === 0) {
        const title = await scrapeEtherscan(account, 'UNKNOWN')
        return title
      }
      return symbol
    }
    return await scrapeEtherscan(account, 'NOID')
  }
  return symbol
}

function hex2a(hexx) {
  const hex = hexx.toString()
  let str = ''
  for (var i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  return str
}

const main = async () => {
  for (let i = 0; i < popularFile.length; i++) {
    if (popularFile[i].count > 9) {
      const name = await getAccountInfo(popularFile[i].account)
      console.log(String(i + ':').padEnd(7) + popularFile[i].account + ': ' + name)
      // TODO collect for output and generate sql file
    }
  }
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }

;( async () => {
  try {
    await main()
  } catch (error) {
    console.log(error)
  }
  process.exit()
})()