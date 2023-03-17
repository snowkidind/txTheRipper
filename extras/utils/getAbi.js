const fs = require('fs')
const axios = require('axios')
const redis = require('../../db/redis.js')

const proxyMap = [
  ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', '0xB7277a6e95992041568D9391D09d0122023778A2'], // USDC
  ['0x9BE89D2a4cd102D8Fecc6BF9dA793be995C22541', '0x9F344834752cb3a8C54c3DdCd41Da4042b10D0b9'], // Binance Peggy Token
  ['0xe2f2a5C287993345a840Db3B0845fbC70f5935a5', '0xE4c5b1765BF420016027177289908C5A3Ea7668E'], // Masset Structs
  ['0x8E870D67F660D95d5be530380D0eC0bd388289E1', '0x86Eee0422322710866aF89E9cAe3F7383d55310a'], // PAX
  ['0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D', '0xe2d6cCAC3EE3A21AbF7BeDBE2E107FfC0C037e80'], // REN
  ['0x1c48f86ae57291F7686349F12601910BD8D470bb', '0x5680061F983b4f325Dd1476E8317120b46E1f1C4'], // USDK
  ['0xBcca60bB61934080951369a648Fb03DF4F96263C', '0xbce3076b0d8eb2f640d4089a4929fe8c1a438213'],
  ['0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811', ''],
  ['0x028171bCA77440897B824Ca71D1c56caC55b68A3', '0xb7bf8e4908ad1caf1a638b30ef80afc581fdc968'],
  ['0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643', '0x976aa93ca5Aaa569109f4267589c619a097f001D'], //cDai
  ['0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', '0x20dC62D5904633cC6a5E34bEc87A048E80C92e97'],
  ['0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811', '0x3F06560cfB7af6E6B5102c358f679DE5150b3b4C'],
  ['0x8ab7404063ec4dbcfd4598215992dc3f8ec853d7', '0xEaA04Ea9a674d755B9c2fD988d01F7A1C9D116dA'], // AKRO
  ['0xd46ba6d942050d489dbd938a2c909a5d5039a161', '0xD0e3F82ab04B983C05263cF3BF52481FbAa435b1'] // ampl
]

exports.getAbi = async (_address, blockchain = 'mainnet', printReq) => {
  
  const path = process.env.BASEPATH + '/derived/abi/'
  const fileName = _address + '.json'
  const fullPath = path + fileName
  if (fs.existsSync(fullPath)) {
    const fileAbi = await fs.readFileSync(fullPath, 'utf8')
    return [JSON.parse(fileAbi), 'EC']  // etherscan Cache
  } else {
    let address = _address
    if (address === '0x1') {
      return [erc20abi, 'CA'] // Cache Abi
    } else {
      proxyMap.forEach((map) => {
        if (_address === map[0]) {
          address = map[1]
        }
      })
    }
    let url
    if (blockchain === 'mainnet') {
      url = 'https://api.etherscan.io/api?module=contract&action=getabi&address=' + address + '&apikey=' + process.env.ETHERSCAN_API_KEY
    } else if (blockchain === 'fantom') {
      url = 'https://api.ftmscan.com/api?module=contract&action=getabi&address=' + address + '&apikey=' + process.env.FTMSCAN_API_KEY
    }

    // Retry failed etherscan calls
    axios.interceptors.response.use(undefined, (err) => {
      const { config, message } = err
      if (!config || !config.retry) {
        return Promise.reject(err)
      }
      if (!(message.includes("timeout") || message.includes("Network Error"))) {
        return Promise.reject(err)
      }
      config.retry -= 1
      const delayRetryRequest = new Promise((resolve) => {
        setTimeout(() => {
          console.log("NOTICE: retry: " + config.url)
          resolve()
        }, 5000)
      })
      return delayRetryRequest.then(() => axios(config))
    })
    let response, error
    if (printReq) console.log('GET: ' + url)
    response = await axios.get(url, { retry: 3 })
      .catch(err => {
        const errorMsg = 'Etherscan Request Error: ' + JSON.stringify(err.message)
        error = errorMsg
      })
    if (error) {
      console.log(error)
      return []
    } else if (response && response.data.status === '0') {
      if (printReq) console.log('Error Abi lookup failed: ' + response.data.result)
      return []
    }

    // Dont send a request more often than every request_rate seconds
    // NOTE This is still ineffective if other scripts dont use the same key
    const request_rate = process.env.ETHERSCAN_REQ_RATE || 2
    const key = "multiEth:etherscan_rate_limit"
    const limit = await redis.get(key)
    if (!limit) {
      await sleep(request_rate * 1000)
    }
    redis.set(key, request_rate, request_rate)

    JSON.parse(response.data.result).forEach((fn) => {
      if (fn.name === 'implementation' || fn.name === 'implementation()') {
        // console.log('NOTICE: Proxy Detected...')
        return []
      }
    })
    let abi = JSON.parse(response.data.result)
    let keepAbi = []
    abi.forEach((thing) => { // Mash 4077 cleanup here
      let keep = true
      if (thing.type === 'event') { // example at: 0x48c80f1f4d53d5951e5d5438b54cba84f29f32a5
        if (thing.name.includes('(')) { // Improperly formatted abi
          keep = false
        }
      }
      if (thing.hasOwnProperty('gas')) {
        delete thing.gas;
      }
      if (thing.name === 'claimable_reward') {
        thing.stateMutability = 'view';
      }
      if (keep) keepAbi.push(thing)
    })
    fs.writeFileSync(fullPath, JSON.stringify(keepAbi, null, 4))
    const fileAbi = fs.readFileSync(fullPath, 'utf8')
    return [JSON.parse(fileAbi), 'EA'] // etherscan API
  }
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }