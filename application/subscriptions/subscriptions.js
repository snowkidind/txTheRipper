
const { dbSubscriptions } = require('../../db')

module.exports = {
  handleRoute: async (request) => {
    const { payload } = request
    const { message, profile } = payload
    
    // User to request current subscriptions
    if (message.action === 'subscriptions') {
      const subscriptions = await dbSubscriptions.get(profile.id)
      return subscriptions
    }

    // account is a listener for transactions related to a specified account
    // there will be several event types: Contract creation event, events emitted, value > x, contract<type> created
    if (message.eventType === 'account') {
      const subscriptions = await dbSubscriptions.getDetail(profile.id, message.eventDetail) // array of db subscriptions

      // User to subscribe to listening to an account
      if (message.action === 'subscribe') {
        const id = await dbSubscriptions.add(profile.id, 'accounts', message.eventDetail.toLowerCase(), { types: 'all' }) // metadata argument is intended for forward compatibility
        if (typeof id !== 'undefined') {
          return 'Added subscription.'
        } else {
          return 'Couldn\'t add subscription'
        }
      } 
      
      // User to unsubscribe from existing listener
      else if (message.action === 'unsubscribe') {
        if (subscriptions.length > 0) {
          const id = await dbSubscriptions.drop(profile.id, message.eventDetail)
          if (typeof id !== 'undefined') {
            console.log('Drop ' + id + ' ' + profile.id + ' ed ' + message.eventDetail)
            return 'Dropped subscription with id: ' + id
          } else {
            return 'Couldn\'t find subscription to drop.'
          }
        }
      }
    }
  }
}