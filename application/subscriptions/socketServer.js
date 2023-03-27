const env = require('node-env-file')
const fs = require('fs')
env(__dirname + '/../../.env')
const ipc = require('./ipc.js')
const events = require('../../utils/events.js')
const { log, logError } = require('../../utils/log')

const listeners = []

/* 
  Deliver Notifications via a unix socket interface

  subscriptions with the unix_socket deliveryMethod are routed to the unix socket when the 
  criteria is matched.

  To enable unix socket based subscriptions you must specify the SUB_USE_UNIX_SOCKET=true key
  in .env as well as any particular services to enable such as SUB_TYPE_ACCOUNT=true
  Be sure to specify the same socket your listener will connect to via SUB_UNIX_SOCKET=/path/to/ripper.sock
  (currently only the account matching module is available, but more modules are planned)

  With unix sockets, since the socket takes into account who is listening, only notifications related
  to currently connected listeners will be delivered via the interface. A setListener message must be 
  sent to register your listener once via the unix socket. This does not persist over server restarts, and 
  your socket will be discconnected in that case.
  
  See /application/subscriptions/examples for implementation details.
  
  to globally disable all subscription methods set SUB_SUSPEND_ALL=false in order to preserve system 
  resources for other tasks

*/

/* 
  handle a valid request
  profile, client set id, and message type are included in all responses
*/
const routeEvent = async (request) => {
  const { payload, client } = request
  // A client needs to call the setListener event in order to begin receiving subscription notifications 
  if (payload.message.type === 'setListener') {
    log('Subscriptions: New Client Listener:' + client + ' profile: ' + payload.profile.identifier, 1)
    listeners.push({ client: client, id: payload.profile.id })
    const id = typeof payload.message.id === 'undefined' ? -1 : payload.message.id // mirror id param if sent
    ipc.sendMessage(client, {
      response: 'listenerSet',
      profile: payload.profile,
      id: id,
      type: payload.message.type
    })
  }
  return false
}

(async () => {
  try {
    events.emitter.on('ipc:message', async (payload) => { // handle setListener event
      await routeEvent(payload)
    })
    if (fs.existsSync(process.env.SUB_UNIX_SOCKET)) fs.rmSync(process.env.SUB_UNIX_SOCKET) // kill old socket on sight
    ipc.newServer(process.env.SUB_UNIX_SOCKET) // Create a new socket server.
    events.emitter.on('outgoing:socket', (message) => { // send message to associated client
      listeners.forEach((l) => {
        if (l.id === message.profileId) ipc.sendMessage(l.client, message)
      })
    })
  } catch (error) {
    logError(error)
  }
})()