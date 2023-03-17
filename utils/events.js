const events = require('events')
const emitter = new events.EventEmitter()
emitter.setMaxListeners(2) // todo refactor this as a config parameter

// const watching = []

// // Note this protects against other types entering into the stream but
// // does not protect against unappropriately timed events of the same type.
// emitter.on('data', function (data) {
//   const message = JSON.parse(data)
//   let found = -1
//   for (let i = 0; i < watching.length; i++) {
//     if (watching[i].event === message.type) {
//       found = i
//       watching[i].callback(message)
//     }
//   }
//   if (found > -1) {
//     watching.splice(found, 1)
//   }
// })

module.exports = {
  
  init: () => {
    process.on("exit", () => {
      emitter.emit('exit', 'The program will exit.')
    })
  },
  
  emitter: emitter,
  emitMessage: (message, object) => {
    emitter.emit(message, object)
  }

  // watch: (event, callback) => {
  //   watching.push({ event: event, callback: callback })
  // }
}
