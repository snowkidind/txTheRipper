const ethers = require('ethers')
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_NODE, 1)
const { log } = require('../utils/log')
const { events, jobTimer } = require('../utils/')
const { start, stop } = jobTimer
const { extractBatch } = require('./extractBatch.js')
const { convertBatchAccounts } = require('./convertBatch.js')
const { importTransactionsToPg } = require('./importPg.js')
const { updateAppData } = require('./finalizeBatch.js')

const { dbAppData, dbInit } = require('../db')
const confirmations = Number(process.env.CONFIRMATIONS) || 20

module.exports = {

  synchronize: async () => {

    start('Synchronize - The whole round.')
    
    log('NOTICE: Beginning synchronization process.', 1)
    if (await dbAppData.pauseStatus() === true) {
      log('WARNING: Application is paused, exiting safely', 1)
      
      return
    }
    const blockHeight = await provider.getBlockNumber()
    const lastSyncPoint = await dbAppData.getLastBlockSynced()
    if (blockHeight - lastSyncPoint < confirmations) {
      log('NOTICE: Database is in sync: nodeHeight: ' + blockHeight + ' last sync point: ' +  lastSyncPoint, 1)
      return
    }
    
    await dbInit.checkPartitions()
    
    /* 
      The first step in the process is to extract the transactions from the archive node. 
      Here, Blocks are sequentially read and traced. The trace data is then used to 
      collect any possible addresses related to the transaction
    
      Each iteration of this gets its own ID and all files related are isolated. 
      Unless the entire import process of this range completes,
      the indexer will pick up from the same spot. 

      This gives some level of idempotence for the application, but when the process doesnt
      complete because of an issue, some inert files may be left around. As long as the
      application isnt running, it is safe to remove files from /derived/tmp
    */

    const jobId = await extractBatch(blockHeight, lastSyncPoint)

    /* 
      In order to save a lot of disk space and read writes, popular accounts are collected 
      and then stored in a table and then assigned a numeric replacement for their account. 
      The numeric account ID is then stored in the DB. This causes a dependency on lookup
      tables but it extends the life of SSD's and NVMe's
    */
    await convertBatchAccounts(jobId)

    /* 
      Once the JSON files have been processed, then the script generates a sql file for postgres
      to run (on a separate thread) This utilizes multi cores.
    */
    const success = await importTransactionsToPg(jobId)

    /* 
      Finally, after a successful PG query, the app data is updated with the latest block 
      information and the process is restarted from the top.
    */
    await updateAppData(success, jobId)

    stop('Synchronize - The whole round.')

    await module.exports.synchronize()
  }
}
