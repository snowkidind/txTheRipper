const events = require('../../utils/events.js')
const { logError, log } = require('../../utils/log.js')

module.exports = {

  init: () => {
    // Launch the servers
    // these need the database to be inited to be called
    if (process.env.SUB_SUSPEND_ALL === 'false' && process.env.SUB_USE_UNIX_SOCKET === 'true') require('./socketServer.js')
    if (process.env.SUB_SUSPEND_ALL === 'false' && process.env.SUB_USE_REDIS === 'true') require('./redisServer.js')
    log('Subscriptions: routers initialized', 1)
  },

  data: (block) => {
    try {
      if (process.env.SUB_SUSPEND_ALL === 'true') return // enable subscriptions
      const [transactions, newContracts, parsedTrace] = block
      if (process.env.SUB_USE_UNIX_SOCKET === 'true' || process.env.SUB_USE_REDIS === 'true') { // enable unix / redis sockets
        if (process.env.SUB_TYPE_ACCOUNT === 'true') { // enable account based subscriptions
          for (hash in transactions) {
            events.emitMessage('subs:accounts', [hash, transactions[hash], parsedTrace[hash]])
          }
        }
      }
    } catch (error) {
      logError(error)
    }
  }
}