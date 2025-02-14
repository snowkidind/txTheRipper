const { exec } = require('child_process')
const fs = require('fs')
const { dbAppData } = require('../db')
const { jobTimer } = require('../utils')
const { start, stop, getId } = jobTimer
const { log, logError } = require('../utils/log')

const baseDir = process.env.BASEPATH + 'derived/tmp/'
const useRam = process.env.OPTIMIZE_DISK_WRITES === 'true' ? true : false

const parseDbToDisplay = (string) => {
  const lines = string.split('\n')
  lines.forEach((l) => {
    if (l !== '') log(l, 1)
  })
}

const addDb = (fileToRead) => {
  return new Promise((resolve, reject) => {
    exec('psql -d ' + process.env.DB_NAME + ' -f ' + fileToRead, (error, stdout, stderr) => {
      if (error) {
        logError(error.message, 1)
        reject()
      }
      if (stderr) {
        logError(stderr, 1)
        reject()
      }
      parseDbToDisplay(stdout)
      resolve()
    })
  })
}

module.exports = {
  importTransactionsToPg: async (jobId, _data) => {
    // only for archive db
    if (process.env.OPERATION_MODE === 'subscription') {
      return
    }
    const pause = await dbAppData.pauseStatus()
    if (pause) {
      log('NOTICE: >>>>>>> Import Pg: Pause flag detected <<<<<< Will Exit at end of this cycle.', 1)
    }

    const batchJsonFile = baseDir + jobId + '.json'

    // To calculate topic.parentId in a deterministic way we cannot rely on 
    // the internal database sequence because the tables are partitioned
    // therefore we track it on our own.
    let transactionId = await dbAppData.getInt('transactionId')
    if (typeof transactionId === 'undefined') {
      log("NOTICE: initializing transactionId_seq to 0", 2)
      transactionId = await dbAppData.setInt('transactionId', 0)
    }
    // Since the transactionId can be larger than an integer size, the db returns a string.
    let id = Number(transactionId) + 1

    // First, generate a sql file out of the JSON
    log('NOTICE: Importing Batch to database', 2)
    start('Import To PG')
    let json
    if (useRam) {
      json = _data
    } else {
      const _json = fs.readFileSync(batchJsonFile)
      json = JSON.parse(_json)
    }
    if (json.length === 0) {
      return true
    }
    
    let f1 = 'INSERT INTO transactions ("id", "block", "timestamp", "hash") VALUES \n'
    let f2 = 'INSERT INTO topic ("parent", "account") VALUES \n'
    for (let k = 0; k < json.length; k++) {
      const data = json[k]
      f1 += '(' + id + ',' + data.block + ',' + data.timestamp + ',\'' + data.hash + '\'),\n'
      for (let l = 0; l < data.topics.length; l++) {
        // RangeError: Invalid string length = id was a string
        f2 += '(' + id + ',\'' + data.topics[l] + '\'),\n'
      }
      id += 1
    }
    const sqlFile = batchJsonFile.replace('.json', '.sql')
    log('writing to file: ' + sqlFile, 2)

    const insertId = id + 1

    const file = 'BEGIN;\n' + 
                 f1.substring(0, f1.length - 2) + ';\n\n' + 
                 f2.substring(0, f2.length - 2) + '; \n\n' + 
                 'UPDATE application_data SET value_int = ' + insertId + ' WHERE field = \'transactionId\';\n' + 
                 'COMMIT;\n'
    fs.writeFileSync(sqlFile, file)

    // Now read the file into PG
    try {
      await addDb(sqlFile)
      stop('Import To PG', true)
      return true
    } catch (error) {

      // This will stop you at the last good inserted file and exit if the db had an issue with current one.
      logError(error)
      log('Notice: Couldn\'t insert file into database. exiting.', 1)
      log('The problem was at file: ' + jobId, 1)
      return false
    }
  }
}