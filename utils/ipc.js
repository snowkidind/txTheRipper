const net = require('net')
const { log, logError } = require('../utils/log')
const { randomString } = require('../utils/system.js')
const { dbApiKeys, dbProfiles } = require('../db')
const events = require('../utils/events.js')

let connections = {}

const checkApiKey = async (apiKey) => {
  const dbKey = await dbApiKeys.get(apiKey)
  if (typeof dbKey !== 'undefined') {
    return dbKey
  }
  return false
}

module.exports = {
  newServer: (socketFile = process.env.UNIX_SOCKET) => {
    return new Promise ((resolve, reject) => {
      try {
        const server = net.createServer( c => {
          const id = randomString(16)
          connections[id] = c
          c['id'] = id
          c.on('error', (error) => { 
            c.destroy()
            delete connections[id]
            logError(error)
          })
          c.on('end', () => { 
            log('Client Disconnected: ' + c.id)
            c.destroy()
            delete connections[id] 
          })

          // Requests must be a formatted object and contain the type property and an apiKey property
          c.on('data', async (msg) => {
            let message
            try {
              message = JSON.parse(msg)
              if (typeof message.apiKey === 'undefined') {
                c.write(JSON.stringify({ error: 'Cannot Authenticate: Message must have an apiKey property' }, null, 2))
                return
              }
              if (typeof message.type === 'undefined') {
                c.write(JSON.stringify({ error: 'Cannot Route: Message must have a type property' }, null, 2))
                return
              }
            } catch (error) {
              console.log(error)
              c.write(JSON.stringify({ error: 'Invalid JSON' }, null, 2))
              return
            }
            const apiKey = await checkApiKey(message.apiKey)
            if (typeof apiKey === 'undefined') {
              module.exports.sendMessage(message.client, { error: 'invalid credentials' }, true)
              return
            }
            const profile = await dbProfiles.get(apiKey.profileId)
            if (typeof profile === 'undefined') {
              module.exports.sendMessage(message.client, { error: 'profile for api key is missing' }, true)
              return
            }
            const payload = { message: message, profile: profile }
            events.emitMessage('message', { client: c.id, payload: payload })
          })
          resolve(c)
        })
        server.on('error', (error) => {
          reject(error)
        })
        server.listen(socketFile)
        server.on('connection', function (socket) {
          socket.write(JSON.stringify({ version: 'txTheRipper 0.0.0' }))
        })
      } catch (error) {
        logError(error)
        reject(error)
      }
    }) 
  },

  writeAll: (message) => {
    if (typeof message !== 'object') throw "Cannot stringify something that is not an object!"
    for (c in connections) {
      connections[c].write(JSON.stringify(message))
    }
  },

  sendMessage: (id, message, disconnect) => {
    if (typeof message !== 'object') throw "Cannot stringify something that is not an object!"
    if (connections[id]) connections[id].write(JSON.stringify(message))
    if (disconnect) {
      connections[id].destroy()
    }
  }
}
