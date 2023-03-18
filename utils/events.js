const events = require('events')
const emitter = new events.EventEmitter()
emitter.setMaxListeners(10)

module.exports = {
  emitter: emitter,
  emitMessage: (message, object) => {
    console.log('Emit Msg: ' + message)
    emitter.emit(message, object)
  }
}
