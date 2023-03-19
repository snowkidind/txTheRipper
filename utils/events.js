const events = require('events')
const emitter = new events.EventEmitter()
emitter.setMaxListeners(10)

module.exports = {
  
  emitter: emitter,

  emitMessage: (message, object) => {
    emitter.emit(message, object)
  },

  asyncListener: (eventType) => {
    return new Promise(async (resolve) => {
      emitter.on(eventType, async (data) => {
        resolve(data)
      })
    })
  }
}
