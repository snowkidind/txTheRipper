const env = require('node-env-file')
env(__dirname + '/../../.env')
const events = require('../../utils/events.js')
const { dbRedis, dbAppData, dbSubscriptions } = require('../../db')
const { log, logError } = require('../../utils/log.js')
const system = require('../../utils/system.js')

/* 
  Deliver Notifications via the redis interface

  In order to deliver notifications to another script via redis, redis provides a 
  Pub.Sub interface that conveniently suffices for anonymous publishers and subscribers:
  see also https://redis.io/docs/manual/pubsub/
  
  Subscriptions with the redis_mem deliveryMethod are routed to redis when the 
  criteria is matched.

  If you dont have any subscriptions the service is automatically disabled and requires 
  a restart with an enabled subscription in order to allow the service to initialize. 

  Since the redis implementation is anonymous, any connection can listen for any event
  if a subscription exists for it. For instance if an application is tracking an EOA 
  another application may get the subscription and also listen to it. The unix socket 
  provides a more private variation where each listener is required to subscribe before 
  receiving their own notifications.

  Also, to enable redis based subscriptions you must specify the SUB_USE_REDIS=true key
  in .env as well as any particular services to enable such as SUB_TYPE_ACCOUNT=true
  (currently only the account matching module is available, but more are planned)

  use the clientConfig cli to initialize subscriptions and interact with enabling and 
  disabling subscriptions

*/

let acctSubs

const pollAccountSubs = async () => {
  acctSubs = await dbSubscriptions.getAll('accounts', 'redis_mem')
  setTimeout(pollAccountSubs, 10000)
}

/* 
  determine a user is subscribed to a particular route
*/
const hasAccountsSub = (route, account) => {
  let found = false
  acctSubs.forEach((s) => {
    if (s.routeHandler === route && s.reference === account) {
      found = true
    }
  })
  return found
}

;(async () => {

  await pollAccountSubs() // TODO improve method to keep subs up to date
  if (acctSubs.length === 0) {
    log('redis_mem: No subscriptions, assuming unused. adding a subscription using redis will require restart.', 1)
    return // Might require a restart under certain circumstance but saves cpu under unnecessary conditions  
  }

  events.emitter.on('subs:accounts', (txInfo) => { // parse incoming stream of data
    const [hash, topics, trace] = txInfo
    topics.forEach(async (topic) => { // search the data for matching entries and forward as needed
      if (hasAccountsSub('accounts', topic)) {
        // log('SubsMatch: ' + hash + ' -> anon listener')
        // system.memStatsOneLine()
        const mem = JSON.stringify({
          hash: hash,
          topics: Array.from(topics),
          trace: trace,
          type: 'accounts'
        })
        const channel = 'ripper:accounts:' + topic
        await dbRedis.publish(channel, mem)
      }
    })
  })

})()
