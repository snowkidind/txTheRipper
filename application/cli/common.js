const { log, logToFile } = require('../../utils/log')

module.exports = {
  getAnswer: (rl, message, menu) => {
    logToFile(message, 1)
    return new Promise((resolve) => {
      rl.question(message + '\n > ', async (answer) => {
        if (answer === 'c') {
          log('Operation Cancelled', 1)
          menu()
          return
        }
        resolve(answer)
      })
    })
  },

  execute: async (rl, message, menu) => {
    logToFile(message, 1)
    const executeAction = await module.exports.getAnswer(rl, message + " - execute? (y, c)", menu)
    if (executeAction !== 'y') {
      log('Operation Canceled.', 1)
      menu()
      return
    }
    return true
  }
}