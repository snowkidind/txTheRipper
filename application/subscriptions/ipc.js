const net = require('net')
const { log, logError } = require('../../utils/log')
const { randomString } = require('../../utils/system.js')
const { dbProfiles } = require('../../db')
const events = require('../../utils/events.js')

let connections = {}

module.exports = {
  newServer: (socketFile = process.env.SUB_UNIX_SOCKET) => {
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

          // Requests must be a formatted object and contain the type property
          c.on('data', async (msg) => {
            let message
            try {
              message = JSON.parse(msg)
              if (typeof message.type === 'undefined') {
                c.write(JSON.stringify({ error: 'Cannot Route: Message must have a type property' }, null, 2))
                return
              }
            } catch (error) {
              logError(error)
              c.write(JSON.stringify({ error: 'Invalid JSON' }, null, 2))
              return
            }
            const profile = await dbProfiles.getByIdentifier(message.identifier)
            if (typeof profile === 'undefined') {
              module.exports.sendMessage(message.client, { error: 'profile for identifier is missing' }, true)
              return
            }
            const payload = { message: message, profile: profile }
            events.emitMessage('ipc:message', { client: c.id, payload: payload })
          })
          resolve(c)
        })
        server.on('error', (error) => {
          reject(error)
        })
        server.listen(socketFile)
        server.on('connection', function (socket) {
          socket.write(JSON.stringify({ version: 'txTheRipper 0.0.0' }) + '\n')
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
    if (connections[id]) connections[id].write(JSON.stringify(message) + '\n')
    if (disconnect) {
      if (connections[id]) connections[id].destroy()
    }
  }
}
