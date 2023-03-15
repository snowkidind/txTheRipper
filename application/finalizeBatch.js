const { log, logError } = require('../utils/log')

module.exports = {

  updateAppData: async () => {
    log('NOTICE: Updating Application Data with batch information', 2)
  },

  cleanBatch: async () => {
    log('NOTICE: Finalizing completed batch', 2)
  }

}