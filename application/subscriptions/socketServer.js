const env = require('node-env-file')
const fs = require('fs')
env(__dirname + '/../../.env')
const ipc = require('./ipc.js')
const events = require('../../utils/events.js')
const { dbSubscriptions, dbAppData } = require('../../db')
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
  sent to register your listener via the unix socket. This does not persist over server restarts, and 
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
    ipc.sendMessage(client, {
      response: 'listenerSet',
      profile: payload.profile,
      id: payload.message.id,
      type: payload.message.type
    })
  }
  return false
}

/* 
  Refresh database information  every 10s TODO improve
*/
const pollAccountSubs = async () => {
  acctSubs = await dbSubscriptions.getAll('accounts', 'unix_socket')
  setTimeout(pollAccountSubs, 10000)
}

/* 
  determine a user is subscribed to a particular route
*/
let acctSubs
const hasAccountsSub = (profileId, route, account) => {
  let found = false
  acctSubs.forEach((s) => {
    if (s.profileId === profileId && s.routeHandler === route && s.reference === account) {
      found = true
    }
  })
  return found
}

(async () => {
  try {
    await pollAccountSubs() // TODO improve method to keep subs up to date
    events.emitter.on('message', async (payload) => {
      await routeEvent(payload)
    })
    if (fs.existsSync(process.env.SUB_UNIX_SOCKET)) fs.rmSync(process.env.SUB_UNIX_SOCKET) // kill old socket on sight
    
    // Create a new socket server.
    ipc.newServer(process.env.SUB_UNIX_SOCKET)

    // When a event is received, see fi a listener exists for the event and forward if a match is found
    events.emitter.on('subs:accounts', (txInfo) => { // parse incoming stream of data

      // A listener is a connected client, these are removed when a client disconnects
      listeners.forEach((l) => {
        const [hash, topics, trace] = txInfo
        topics.forEach((topic) => { // search the data for matching entries and forward as needed
          if (hasAccountsSub(l.id, 'accounts', topic)) {
            log('SubsMatch: ' + hash + ' -> ' + l.id )
            ipc.sendMessage(l.client, {
              hash: hash,
              topics: Array.from(topics),
              trace: trace,
              type: 'accounts'
            })
          }
        })
      })
    })
  } catch (error) {
    logError(error)
  }
})()