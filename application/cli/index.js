const env = require('node-env-file')
env(__dirname + '/../../.env')
const readline = require('node:readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
const fs = require('fs')

const { getAnswer, execute } = require('./common.js')
const { system } = require('../../utils')
const { dbAppData } = require('../../db')
const { log, logError, clearLog } = require('../../utils/log')

const mainMenu = async () => {

  const pause = await dbAppData.pauseStatus() ? 'Paused' : 'Not Paused'
  
  let menu = "\n  ####### Main Menu: #######\n\n"
  menu += "  n    Nuke the database\n"
  menu += "  p    Pause the application, currently: " + pause + "\n"
  menu += "  u    Unpause the application\n"
  menu += "  xl   Clear log file\n"
  menu += "  q    Exit\n\n"
  menu += "  Enter a command:\n "

  const answer = await getAnswer(rl, menu, mainMenu)
  const args = answer.split(' ')
  const query = args[0]

  if (query === "n") {
    const message = "Nuke the entire Database?"
    const execute = await getAnswer(rl, message, mainMenu)
    if (execute === 'y') {
      const fullPath = __dirname + '/../../db/schema/schema_nuke.sql'
      const cmd = 'psql -d ' + process.env.DB_NAME + ' -f ' + fullPath
      await system.execCmd(cmd)
      log('Nuked. You will have to fix this once partitions get involved.', 1)
      process.exit()
    } else {
      mainMenu()
      return
    }
  }

  else if (query === "p") {
    const execute = await getAnswer(rl, 'Pause Application? (y)', mainMenu)
    if (execute === 'y') {
      await dbAppData.markPaused()
    }
  }
  
  else if (query === "u") {
    const execute = await getAnswer(rl, 'Unpause Application? (y)', mainMenu)
    if (execute === 'y') {
      await dbAppData.markUnPaused()
    }
  }

  else if (query === "xl") {
    const execute = await getAnswer(rl, 'Clear Log File? (y)', mainMenu)
    if (execute === 'y') {
      clearLog()
    }
  }

  else if (query === "q") {
    log("Exit Application from Cli", 1)
    rl.close()
    process.exit()
  }
  mainMenu()
}

  ; (async () => {
    try {
      await mainMenu()
    } catch (error) {
      logError(error, 'Application Error')
      process.exit(1)
    }
  })()