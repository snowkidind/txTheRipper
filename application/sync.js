const ethers = require('ethers')
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const { log } = require('../utils/log')
const { extractBatch } = require('./extractBatch.js')
const { convertBatchAccounts } = require('./convertBatch.js')
const { importTransactionsToPg } = require('./importPg.js')
const { updateAppData, cleanBatch } = require('./finalizeBatch.js')

const { dbAppData, dbContractCache, dbInit } = require('../db')

module.exports = {

  synchronize: async () => {
    log('NOTICE: Beginning synchronization process.', 1)
    if (await dbAppData.pauseStatus() === true) {
      log('WARNING: Application is paused and will stop when current jobs are complete.', 1)
      return
    }
    const cacheLimit = await dbContractCache.cacheSize()
    const addressCache = await dbContractCache.getCache(cacheLimit)
    const blockHeight = await provider.getBlockNumber()
    const lastSyncPoint = await dbAppData.getLastBlockSynced()
    await dbInit.checkPartitions()
    await extractBatch(blockHeight, lastSyncPoint)
    await convertBatchAccounts(addressCache)
    await importTransactionsToPg()
    await updateAppData()
    await cleanBatch()
  }
}
