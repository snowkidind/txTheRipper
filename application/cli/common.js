module.exports = {
  getAnswer: (rl, message, menu) => {
    return new Promise((resolve) => {
      rl.question(message + '\n > ', async (answer) => {
        if (answer === 'c') {
          console.log('Operation Cancelled')
          menu()
          return
        }
        resolve(answer)
      })
    })
  },

  execute: async (rl, message, menu) => {
    const executeAction = await module.exports.getAnswer(rl, message + " - execute? (y, c)", menu)
    if (executeAction !== 'y') {
      console.log('Operation Canceled.')
      menu()
      return
    }
    return true
  }
}