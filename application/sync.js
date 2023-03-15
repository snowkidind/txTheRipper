const ethers = require('ethers')

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)

const { dbAppData, dbContractCache } = require('../db')

module.exports = {

  synchronize: async () => {
    console.log('NOTICE: Beginning synchronization process.')
    if (await dbAppData.pauseStatus() === true) {
      console.log('WARNING: Application is paused and will stop when current jobs are complete.')
      return
    }

    const cacheLimit = await dbContractCache.cacheSize()
    const addressCache = await dbContractCache.getCache(cacheLimit)
    const blockHeight = await provider.getBlockNumber()
    const lastSyncPoint = await dbAppData.getLastBlockSynced()

  }
}
