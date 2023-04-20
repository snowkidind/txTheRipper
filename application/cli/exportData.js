const fs = require('fs')
const { getAnswer } = require('./common.js')
const { dbContractCache, dbAppData } = require('../../db/index.js')
const { log, logError } = require('../../utils/log.js')
const { execCmd } = require('../../utils/system.js')
let rl

const kickstartDir = process.env.KICKSTARTDIR
const importHeight = kickstartDir + 'importHeight'

const extractData = async () => {
  const blockHeight = await dbAppData.getInt('block_sync')
  let heightOriginal
  if (fs.existsSync(importHeight)) {
    heightOriginal = Number(await fs.readFileSync(importHeight, 'utf8'))
  } else {
    heightOriginal = 0
  }
  if (heightOriginal <= blockHeight) {
    try {
      await execCmd(process.env.EXEC_NODE + ' ' + process.env.BASEPATH + 'application/cli/exportDataChild.js', true)
    } catch (error) {
      logError(error)
      log('Error executing child process.')
      process.exit()
    }
    return extractData()
  }
}

module.exports = {

  mainMenu: async (_rl) => {

    if (!rl) {
      rl = _rl
    }

    const mainMenu = module.exports.mainMenu
    let menu = "\n  ####### Export Data Menu: #######\n\n"
    menu += "  e    Export indexer data\n"
    menu += "  q    Exit\n\n"
    menu += "  Enter a command:\n "
    const answer = await getAnswer(rl, menu, mainMenu)
    const args = answer.split(' ')
    const query = args[0]
    if (query === 'e') {
      const message = 'This will export the entire database into sql files as well as the index cache file.\n this operation may take a while to complete.\nExport data? (y)'
      const answer = await getAnswer(rl, message, mainMenu)
      if (answer !== 'y') {
        mainMenu()
        return
      }
      const cache = await dbContractCache.getAllCache()
      let acc = 'BEGIN;\n'
      acc += 'INSERT INTO contract_cache ("id", "byteId", "account", "weight") VALUES\n'
      cache.forEach((c) => {
        acc += '(' + c.id + ', \'' + c.byteId + '\', \'' + c.account + '\', ' + c.weight + '),\n'
      })
      acc = acc.slice(0, acc.length - 2)
      acc += ';\n'
      acc += 'COMMIT;\n'
      fs.writeFileSync(kickstartDir + 'index_cache.sql', acc)
      log('index_cache.sql written to: ' + kickstartDir, 1)
      await extractData()
    }

    else if (query === "q" || query === "x") {
      log("Exit Application from Cli", 1)
      rl.close()
      process.exit()
    }
    mainMenu()
  }
}

