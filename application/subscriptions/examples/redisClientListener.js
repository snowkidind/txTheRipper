const env = require('node-env-file')
env(__dirname + '/../../../.env')

const { dbRedis, dbProfiles, dbSubscriptions } = require('../../../db')
const events = require('../../../utils/events.js')
const identifier = 'AccountSniffer'

const prefix = 'ripper:accounts:'

;( async () => {
  const profile = await dbProfiles.getByIdentifier(identifier)
  const subs = await dbSubscriptions.getDeliveryMethod(profile.id, 'redis_mem')
  for (let i = 0; i < subs.length; i++) {
    console.log('subscribing to ' + prefix + subs[i].reference)
    events.emitter.on('redis:' + prefix + subs[i].reference, (message) => {
      console.log(JSON.parse(message))
    })
    dbRedis.subscribe(prefix + subs[i].reference)
  }
  // dont die
})()

