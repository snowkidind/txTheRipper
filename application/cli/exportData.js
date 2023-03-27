const fs = require('fs')
const { getAnswer } = require('./common.js')
const { dbProfiles, dbSubscriptions } = require('../../db')
//  const { log, logError } = require('../../utils/log')

let rl

module.exports = {

  mainMenu: async (_rl) => {

    if (!rl) {
      rl = _rl
    }

    const mainMenu = module.exports.mainMenu

    let menu = "\n  ####### Export Data Menu: #######\n\n"
    menu += "  g    Generations\n"
    menu += "  q    Exit\n\n"
    menu += "  Enter a command:\n "
    const answer = await getAnswer(rl, menu, mainMenu)
    const args = answer.split(' ')
    const query = args[0]

    if (query === 'g') {
      console.log('hi')
    }


    else if (query === "q" || query === "x") {
      console.log("Exit Application from Cli", 1)
      rl.close()
      process.exit()
    }
    mainMenu()
  }
}