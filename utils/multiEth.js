const ethers = require('ethers')
const axios = require('axios')
const file = require('./file.js')
const utils = require('./utils.js')
const erc20abi = require('./lib/abi.json')
let inited = false
let provider = {}

// provider support over multiple blockchains
const chainId = {
  'bsc': 56,
  'fantom': 250,
  'kovan': 42,
  'mainnet': 1,
  'matic': 137,
  'ropsten': 3
}

const baseTokens = {
  'bsc': 'BNB',
  'fantom': 'FTM',
  'kovan': 'KETH',
  'mainnet': 'ETH',
  'matic': 'MATIC',
  'ropsten': 'RETH'
}

const getProvider = (blockchain = 'mainnet') => {
  if (inited) {
    return provider[blockchain]
  }
  else {
    // ethers v6
    provider['ropsten'] = new ethers.providers.JsonRpcProvider(process.env.ROPSTEN_NODE, chainId['ropsten'])
    provider['mainnet'] = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, chainId['mainnet'])
    provider['fantom'] = new ethers.providers.JsonRpcProvider(process.env.FANTOM_NODE, chainId['fantom'])
    inited = true
    return provider[blockchain]
  }
}

const getWebSocket = (blockchain = 'mainnet') => {
  if (inited) {
    return provider[blockchain]
  }
  else {
    wsProvider['mainnet'] = new ethers.providers.WebSocketProvider(process.env.RPC_NODE_WS, chainId['mainnet'])
    return wsProvider[blockchain]
  }
}


// Method to extract abi from etherscan automatically (still has issues)

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

const getAbi = async (_address, blockchain = 'mainnet') => {

  const path = __dirname + '/../derived/'
  const fileName = _address + '.json'
  const fullPath = path + fileName
  if (file.fileExists(fullPath)) {
    const fileAbi = await file.readFile(fullPath)
    return JSON.parse(fileAbi)
  } else {

    let address = _address
    if (address === '0x1') {
      // will use USDC contract to represent USD
      return erc20abi

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

    const response = await axios.get(url)
    if (response.data.status === '0') {
      console.log('Error Abi lookup failed: ' + response.data.result)
      return
    }

    console.log('Etherscan API. Punishment: 2 seconds.')
    await utils.sleep(2000)

    // sometimes the proxy abi is returned. So we check the abi for the presence of the symbol and decimals
    // let isProxy = false;
    JSON.parse(response.data.result).forEach((fn) => {
      if (fn.name === 'implementation' || fn.name === 'implementation()') {
        console.log('WARNING: Proxy Detected...')
        console.log('If you are having a crash here, do the following things:')
        console.log('remove the file containing ' + address + ' from the derived directory')
        console.log('update the proxyMap in crvUtils/getAbi.js to include the proxy implementation.')
        console.log('this is a temporary workaround.')
      }
    })
    let abi = JSON.parse(response.data.result)
    abi.forEach((thing) => {
      if (thing.hasOwnProperty('gas')) {
        delete thing.gas;
      }
      if (thing.name === 'claimable_reward') {
        thing.stateMutability = 'view';
      }
    })
    console.log('writing new abi: ' + fullPath);
    await file.writeFile(fullPath, JSON.stringify(abi));
    const fileAbi = await file.readFile(fullPath);
    return JSON.parse(fileAbi)
  }
}


module.exports = {

  getBalance: async (address, blockchain = 'mainnet') => {
    if (!inited) {
      getProvider()
    }
    return await provider[blockchain].getBalance(address)
  },

  baseToken: (chain) => {
    return baseTokens[chain]
  },

  supportedProviders: () => {
    if (!inited) {
      getProvider()
    }
    return Object.keys(provider)
  },

  newSigner: async (mnemonicId, index = 0, blockchain = 'mainnet') => {
    try {
      if (!inited) {
        getProvider()
      }
      let privateKey = await module.exports.getMnemonic(mnemonicId)
      const signer = ethers.Wallet.fromMnemonic(privateKey, `m/44'/60'/0'/0/${index}`).connect(provider[blockchain])
      return signer
    } catch (error) {
      console.log(error)
    }
  },

  getContract: async (address, blockchain = 'mainnet') => {
    try {
      if (!inited) {
        getProvider()
      }
      const abi = await getAbi(address, blockchain)
      if (typeof abi === 'undefined') {
        return
      } else {
        // in the case where you want to compare with something valued at a dollar, supply 0x1 for address, will return USDC
        if (address === '0x1') {
          const usdc = {
            mainnet: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            ropsten: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
            fantom: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75'
          }
          return new ethers.Contract(usdc[blockchain], abi, provider[blockchain])
        } else {
          // console.log(JSON.stringify(abi, null, 4))
          return new ethers.Contract(address, abi, provider[blockchain])
        }
      }
    } catch (error) {
      console.log(error)
    }
  },

  getErc20Contract: async (address, blockchain = 'mainnet') => {
    try {
      if (!inited) {
        getProvider()
      }
      return new ethers.Contract(address, erc20abi, provider[blockchain])
    } catch (error) {
      console.log(error)
    }
  },

  getLastBlock: async (blockchain = 'mainnet') => {
    if (!inited) {
      getProvider()
    }
    return await provider[blockchain].getBlockNumber()
  },

  getBlock: async (blockNumber, blockchain) => {
    if (!inited) {
      getProvider()
    }
    return await provider[blockchain].getBlock(blockNumber, blockchain)
  },

  getBlockTimestamp: async (epoch, blockchain = 'mainnet') => {
    if (!inited) {
      getProvider()
    }
    const block = await provider[blockchain].getBlock(Number(epoch))
    return block.timestamp
  },

  getBlockExplorerUrl: (blockchain = 'mainnet') => {
    let url
    if (blockchain === 'mainnet') {
      url = 'https://etherscan.io/tx/'
    } else if (blockchain === 'ropsten') {
      url = 'https://ropsten.etherscan.io/tx/'
    }
    return url
  },

  shortAddr: (addr) => {
    const a = addr.substring(0, 5)
    const b = '...'
    const c = addr.substring(addr.length - 9)
    return a + b + c
  },

  shortTx: (tx) => {
    const a = tx.substring(0, 9)
    const b = '...'
    const c = tx.substring(tx.length - 3)
    return a + b + c
  },

  getMnemonic: async (mnemonicId) => {
    const key = 'MNEMONIC_' + mnemonicId
    const filePath = __dirname + '/../.envm'
    const data = await file.readFile(filePath)
    const mnemes = data.split('\n')
    for (let i = 0; i < mnemes.length; i++) {
      const kv = mnemes[i].split('=')
      if (kv[0] === key) {
        return kv[1]
      }
    }
    throw 'unknown mnemonic id: ' + mnemonicId
  },

  getProvider,
  getWebSocket,
  getAbi

}
