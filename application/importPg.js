const { log, logError } = require('../utils/log')

module.exports = {
  importTransactionsToPg: async () => {
    log('NOTICE: Importing Batch to database', 2)
  }
}