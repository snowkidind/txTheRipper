const { log, logError } = require('../utils/log')
const { events, jobTimer } = require('../utils/')
const { start, stop } = jobTimer
const { extractBatch } = require('./extractBatch.js')
const { convertBatchAccounts } = require('./convertBatch.js')
const { importTransactionsToPg } = require('./importPg.js')
const { updateAppData } = require('./finalizeBatch.js')

const { dbAppData, dbInit } = require('../db')
const confirmations = Number(process.env.CONFIRMATIONS) || 20
let x = 0

const initialSyncInit = async () => {
  if (process.env.DONT_INDEX === 'true') return
  if (process.env.INDEX_SYNC === true) return
  const inited1 = await dbAppData.getBool('init_sync_1')
  const inited2 = await dbAppData.getBool('init_sync_2')
  const inited3 = await dbAppData.getBool('init_sync_3')
  const inited4 = await dbAppData.getBool('init_sync_4')
  const inited5 = await dbAppData.getBool('init_sync_5')
  if (inited1 === true && inited2 === true && inited3 === true && inited4 === true && inited5 === true) {
    process.env.INDEX_SYNC = true
    return
  }
  log('Initial Sync Init. \n\nNOTICE: Adding Indexes. This could take a while, like 4 to 8 hours. Once its finished the db will be ready.\n', 1)
  
  try {
    await dbAppData.setBool('working', true)
    await dbInit.initIndexes(inited1, inited2, inited3, inited4, inited5)
    await dbAppData.setBool('working', false)
  } catch (error) {
    logError(error, 'ERROR: couldn\'t complete sync. Will retry after restart.')
    await dbAppData.setBool('working', false)
  }
}

const cleanupSync = async () => {
  await dbAppData.setBool('working', false)
  stop('synchronize', true)
}

module.exports = {

  synchronize: async (blockHeight) => {
   
    const inJob = await dbAppData.getBool('working')
    if (inJob === true) {
      return 'ok'
    }
    
    await dbAppData.setBool('working', true)
    if (await dbAppData.pauseStatus() === true) {
      log('WARNING: Application is paused, exiting safely', 1)
      await cleanupSync()
      return 'exit'
    }

    start('synchronize')
    log('NOTICE: Beginning synchronization process.', 1)
    const lastSyncPoint = await dbAppData.getInt('block_sync') // was set to 99981
    const ls = lastSyncPoint // The block we are looking for is one greater than the last block synced
    const bh = blockHeight - confirmations
    if (0 >= bh - ls) {
      log('NOTICE: Database is in sync: nodeHeight: ' + blockHeight + ' last sync point: ' +  lastSyncPoint, 1)
      await initialSyncInit()
      await cleanupSync()
      // events.emitMessage('close', 'sync_complete')
      return 'ok'
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

    const [jobId, data] = await extractBatch(blockHeight, lastSyncPoint)
    if (typeof jobId === 'undefined') {
      // the app crashed or had some issue
      await cleanupSync()
      return 'error'
    }

    /* 
      In order to save a lot of disk space and read writes, popular accounts are collected 
      and then stored in a table and then assigned a numeric replacement for their account. 
      The numeric account ID is then stored in the DB. This causes a dependency on lookup
      tables but it extends the life of SSD's and NVMe's
    */

    let converted
    const indexCacheDisable = process.env.INDEX_CACHE_DISABLE || 'false'
    if (indexCacheDisable === 'false') {
      converted = await convertBatchAccounts(jobId, data)
    } else {
      converted = data
    }
    
    /* 
      Once the JSON files have been processed, then the script generates a sql file for postgres
      to run (on a separate thread) This utilizes multi cores.
    */
    const success = await importTransactionsToPg(jobId, converted)
    if (success === false) {
      await cleanupSync()
      return 'error'
    }
    
    /* 
      Finally, after a successful PG query, the app data is updated with the latest block 
      information and the process is restarted from the top.
    */
    await updateAppData(success, jobId) // update the last block scanned
    await cleanupSync() // sets working to false
    const pause = await dbAppData.pauseStatus()
    if (pause) {
      log('NOTICE: >>>>>>> Synchronize: Pause flag detected <<<<<< Exiting.', 1)
      return 'exit'
    } else {
      return 'ok'
    }
  }
}
