const events = require('../../utils/events.js')
const { logError, log } = require('../../utils/log.js')
const accounts = require('./accounts.js')

module.exports = {

  init: () => {
    // Launch the servers
    // these need the database to be inited to be called
    if (process.env.SUB_SUSPEND_ALL === 'false' && process.env.SUB_USE_UNIX_SOCKET === 'true') require('./socketServer.js')
    if (process.env.SUB_SUSPEND_ALL === 'false' && process.env.SUB_USE_REDIS === 'true') require('./redisServer.js')
    log('Subscriptions: routers initialized', 1)
  },

  data: async (block) => {
    try {
      if (process.env.SUB_SUSPEND_ALL === 'true') return // enable subscriptions
      const [transactions, newContracts, parsedTrace] = block
      if (process.env.SUB_USE_UNIX_SOCKET === 'true' || process.env.SUB_USE_REDIS === 'true') { // enable unix / redis sockets
        for (hash in transactions) {
          const topics = Array.from(transactions[hash])
          // send each transation throuch each wringer if enabled
          if (process.env.SUB_TYPE_ACCOUNT === 'true') await accounts.process(hash, topics, parsedTrace[hash])
          // add additional wringers as needed

        }
      }
    } catch (error) {
      logError(error)
    }
  }
}