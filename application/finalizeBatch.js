const fs = require('fs')

const { dbAppData } = require('../db')
const { log, logError } = require('../utils/log')
const { memStats } = require('../utils/system')
const events = require('../utils/events.js')

const baseDir = process.env.BASEPATH + 'derived/tmp/'
let x = 0
module.exports = {

  updateAppData: async (success, jobId) => {

    log('NOTICE: Updating Application Data with batch information', 2)

    const pause = await dbAppData.pauseStatus()
    if (pause) {
      log('NOTICE: >>>>>>> Pause flag detected <<<<<< Will Exit at end of this cycle.', 1)
    }

    const batchJsonFile = baseDir + jobId + '.json'
    const batchSqlFile = baseDir + jobId + '.sql'
    if (success === true) {
      const _json = fs.readFileSync(batchJsonFile) // get the high block from the Json file before deleting
      const json = JSON.parse(_json)
      let block = -1
      for (let i = 0; i < json.length; i++) {
        if (json[i].block > block) {
          block = json[i].block 
        }
      }
      if (block === -1) {
        const error = new TypeError('could not discover block count.')
        logError(error, 'ERROR: finalize batch: could not discover block count.')
        process.exit()
      }
      const lastBlock = await dbAppData.getLastBlockSynced()
      if (lastBlock >= block) {
        const error = new TypeError('last Block is greater the recent sync block')
        logError(error, 'ERROR: finalize batch: last Block is greater the recent sync block')
        process.exit(1)
      }

      await dbAppData.setLastBlockSynced(block)
      // if (x === 5 ) process.exit()
      x += 1
      fs.rmSync(batchJsonFile)
      fs.rmSync(batchSqlFile)
      log('Round completed to block ' + block + ', preparing to get next block range...',1)
      memStats(true)
      // await sleep(1000) // Pause to reflect for a second...
    }

    // let the system that the loop has reached its end and if they want to exit its all good
    events.emitMessage('close', 'finalize')
    await sleep(200)

  }
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }