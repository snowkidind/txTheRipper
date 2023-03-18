const events = require('events')
const emitter = new events.EventEmitter()
emitter.setMaxListeners(10)

module.exports = {
  emitter: emitter,
  emitMessage: (message, object) => {
    emitter.emit(message, object)
  }
}
