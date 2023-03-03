const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')

const { multiEth, dateutils } = require('./utils')
const { timeFmtDb, dateNowBKK } = dateutils
const provider = multiEth.getProvider('mainnet')
const batch = new ethers.providers.JsonRpcBatchProvider(process.env.RPC_NODE, 1)
const ws = multiEth.getWebSocket()

const perf = require('execution-time')()
const { v4 } = require('uuid')

let logFile
let useWs = true

const maxAcceptableLag = 1 // 1 second per rpc req and you are dead

const main = async () => {

  const lastBlock = await multiEth.getLastBlock('mainnet')
  let earlyBlock = lastBlock - 100

  for (let i = 0; i < 99; i++) {
    const req = await provider.getBlock(earlyBlock)
    earlyBlock += 1
    console.log(req)
    const req2 = await provider.send('erigon_getBlockReceiptsByBlockHash', [req.hash])
    console.log(req2)
    process.exit()
    // for (let j = 0; j < req.transactions.length; j++ ) {
    //   console.log(req.transactions[j])
    //   const req2 = await provider.send('erigon_getBlockReceiptsByBlockHash', req.hash)
    //   console.log(req2)
    //   process.exit()
    // }

    
  }



  // const all = v4()
  // perf.start(all)
  // console.log(timeFmtDb(dateNowBKK()) + ' Beginning Job: ', job.block)

  // const allDuration = perf.stop(all)
  // const message = 'Job ' + job.block + ' completed in ' + allDuration.preciseWords
  // console.log(timeFmtDb(dateNowBKK()) + ' ' + message)

}

  ; (async () => {
    await main()
  })()
