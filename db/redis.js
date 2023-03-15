const _redis = require('redis')
let client

const connect = async () => {
  try {
    if (!client) {
      client = _redis.createClient({
        url: process.env.REDIS_URL
      })
      client.on('error', (err) => {
        console.log(err)
        console.error("Redis is ded");
      })
      await client.connect()
    }
  } catch (error) {
    console.log(error)
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
      console.log(error)
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
      console.log(error)
    }
  },


  del: async (key) => {
    try {
      if (!client) {
        await connect()
      }
      await client.del(key)
    } catch (error) {
      console.log(error)
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
      console.log(error)
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
      console.log(error)
    }
  },
}
