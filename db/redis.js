const _redis = require('redis')
const { log, logError } = require('../utils/log')
const events = require('../utils/events.js')

let client

const connect = async () => {
  try {
    if (!client) {
      client = _redis.createClient({
        url: process.env.REDIS_URL
      })
      client.on('error', (err) => {
        logError(err, 'Database Error')
        console.error("Redis is ded");
      })
      await client.connect()
    }
  } catch (error) {
    logError(error, 'Database Error')
    return null
  }
}

module.exports = {

  get: async key => {
    try {
      if (!client) {
        await connect()
      }
      const data = await client.get(key)
      return data
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  set: async (key, value, expiry = null) => {
    try {
      if (!client) {
        await connect()
      }
      await client.set(key, value)
      if (expiry) {
        await client.expire(key, parseInt(expiry))
      }
    } catch (error) {
      logError(error, 'Database Error')
    }
  },


  del: async (key) => {
    try {
      if (!client) {
        await connect()
      }
      await client.del(key)
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  keys: async (expression) => {
    try {
      if (!client) {
        await connect()
      }
      const keys = await client.keys(expression)
      return keys
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  lrange: (key, start, stop) => {
    return new Promise(async (resolve, reject) => {
      if (!client) {
        await connect()
      }
      client.lrange(key, start, stop, (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  },

  save: async () => {
    try {
      if (!client) {
        await connect()
      }
      const keys = await client.BGSAVE()
      return keys
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  publish: async (channel, message) => {
    try {
      if (!client) {
        await connect()
      }
      const result = await client.publish(channel, message)
      if (result === 1) return true
    } catch (error) {
      logError(error)
    }
  },
  
  subscribe: async (channel) => {
    try {
      if (!client) {
        await connect()
      }
      const channel1sub = client.duplicate()
      await channel1sub.connect()
      await channel1sub.subscribe(channel, (message) => {
        events.emitMessage('redis:' + channel, message.toString())
      }, true)
      return channel1sub
    } catch (error) {
      logError(error)
    }
  },

  unsubscribe: async (channel, _client) => {
    await _client.unsubscribe(channel)
  }
}
