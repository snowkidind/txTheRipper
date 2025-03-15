
const events = require('../../utils/events.js')
const { dbSubscriptions } = require('../../db')
const { logError, log } = require('../../utils/log.js')

let acctSubs

const pollAccountSubs = async () => {
  acctSubs = await dbSubscriptions.getAllEnabled('accounts')
  // idea 1. if the timeout is called before the db returns, then you get a hanging select statement...
  // could happen if another statement is blocking postgresql / table locked etc
  setTimeout(pollAccountSubs, 1000 * 60 * 60) // update once per hour
}

const hasSubscriptions = async (account) => {
  let subscriptions = []
  if (typeof acctSubs === 'undefined') {
    await pollAccountSubs()
  }
  acctSubs.forEach((s) => {
    if (s.reference === account) {
      subscriptions.push(s)
    }
  })
  return subscriptions
}

module.exports = {
  process: async (hash, topics, trace) => {
    try {
      for (let i = 0; i < topics.length; i++) {
        const subscriptions = await hasSubscriptions(topics[i])
        if (subscriptions.length === 0) continue
        for (let j = 0; j < subscriptions.length; j++) {
          let message = {
            hash: hash,
            topic: topics[i], // criteria that matched
            topics: topics,
            trace: trace,
            type: 'accounts'
          }
          if (subscriptions[j].deliveryMethod === 'unix_socket') {
            message['profileId'] = subscriptions[j].profileId // required for unix socket
            events.emitMessage('outgoing:socket', message)
          } else if (subscriptions[j].deliveryMethod === 'redis_mem') {
            events.emitMessage('outgoing:redis', message)
          }
        }
      }
    } catch (error) {
      logError(error)
    }
  }
}
