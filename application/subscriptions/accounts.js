
const events = require('../../utils/events.js')
const { dbSubscriptions } = require('../../db')
const { logError, log } = require('../../utils/log.js')

let acctSubs

const pollAccountSubs = async () => {
  acctSubs = await dbSubscriptions.getAllEnabled('accounts')
  setTimeout(pollAccountSubs, 10000)
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
