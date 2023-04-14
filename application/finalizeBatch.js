const fs = require('fs')

const { dbAppData } = require('../db')
const { log, logError } = require('../utils/log')
const { memStatsOneLine } = require('../utils/system')
const events = require('../utils/events.js')

const baseDir = process.env.BASEPATH + 'derived/tmp/'

module.exports = {
  updateAppData: async (success, jobId) => {
    log('NOTICE: Updating Application Data with batch information', 2)
    const batchJsonFile = baseDir + jobId + '.json'
    const batchSqlFile = baseDir + jobId + '.sql'
    if (success === true || process.env.OPERATION_MODE === 'subscription') { 
      const lastScanned = await dbAppData.getInt('last_block_scanned') // Read Node but potentially not loaded in
      await dbAppData.setInt('block_sync', lastScanned) 
      if (fs.existsSync(batchJsonFile)) fs.rmSync(batchJsonFile)
      if (fs.existsSync(batchSqlFile)) fs.rmSync(batchSqlFile)
      log('Round completed to block ' + lastScanned + ', preparing to get next block range...',1)
      memStatsOneLine()
    }
    await sleep(200)
  }
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }