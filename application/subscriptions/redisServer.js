const env = require('node-env-file')
env(__dirname + '/../../.env')
const events = require('../../utils/events.js')
const { dbRedis } = require('../../db')

/* 
  Deliver Notifications via the redis interface

  In order to deliver notifications to another script via redis, redis provides a 
  Pub.Sub interface that conveniently suffices for anonymous publishers and subscribers:
  see also https://redis.io/docs/manual/pubsub/
  
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

;(async () => {
  events.emitter.on('outgoing:redis', async (message) => { // parse incoming stream of data
    const channel = 'ripper:accounts:' + message.topic
    await dbRedis.publish(channel, JSON.stringify(message))
  })
})()
