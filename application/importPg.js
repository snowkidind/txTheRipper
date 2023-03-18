const { exec } = require('child_process')
const fs = require('fs')
const { dbAppData } = require('../db')
const { jobTimer } = require('../utils')
const { start, stop, getId } = jobTimer
const { log, logError } = require('../utils/log')

const baseDir = process.env.BASEPATH + 'derived/tmp/'

const addDb = (fileToRead) => {
  return new Promise((resolve, reject) => {
    exec('psql -d ' + process.env.DB_NAME + ' -f ' + fileToRead, (error, stdout, stderr) => {
      if (error) {
        logError(error.message)
        reject()
      }
      if (stderr) {
        logError(stderr)
        reject()
      }
      log(stdout.replace(/\n*$/, ""), 2)
      resolve()
    })
  })
}

module.exports = {
  importTransactionsToPg: async (jobId) => {

    const pause = await dbAppData.pauseStatus()
    if (pause) {
      log('NOTICE: >>>>>>> Pause flag detected <<<<<< Will Exit at end of this cycle.', 1)
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
    let id = transactionId + 1

    // First, generate a sql file out of the JSON
    log('NOTICE: Importing Batch to database', 2)
    start('Import To PG')
    const _json = fs.readFileSync(batchJsonFile)
    const json = JSON.parse(_json)
    
    let f1 = 'INSERT INTO transactions ("id", "block", "timestamp", "hash") VALUES \n'
    let f2 = 'INSERT INTO topic ("parent", "account") VALUES \n'
    for (let k = 0; k < json.length; k++) {
      const data = json[k]
      f1 += '(' + id + ',' + data.block + ',' + data.timestamp + ',\'' + data.hash + '\'),\n'
      for (let l = 0; l < data.topics.length; l++) {
        f2 += '(' + id + ',\'' + data.topics[l] + '\'),\n'
      }
      id += 1
    }
    const sqlFile = batchJsonFile.replace('.json', '.sql')
    console.log('writing to file: ' + sqlFile)

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
      console.log(error)
      console.log('Notice: Couldn\'t insert file into database. exiting.')
      console.log('The problem was at file: ' + jobId)
      return false
    }
  }
}