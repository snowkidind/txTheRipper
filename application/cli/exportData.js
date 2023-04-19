const fs = require('fs')
const { getAnswer } = require('./common.js')
const { dbProfiles, dbSubscriptions, dbContractCache, dbAppData, dbTransactions, dbCommon } = require('../../db')
const { log, logError } = require('../../utils/log')
let rl

const kickstartDir = process.env.KICKSTARTDIR
const fileSizeMax = Number(process.env.JSON_TX_FILE_MAX) || 300000000
const importHeight = kickstartDir + 'importHeight'

// number of blocks to pull from sql in a single query
//   if this is too large, Node will not be able to compose the string to write the sql query.
const chunkSize = 1000 
let heightWork

const extractData = async () => {
  try {
    const blockHeight = await dbAppData.getInt('block_sync')
    let heightOriginal
    if (fs.existsSync(importHeight)) {
      heightOriginal = Number(await fs.readFileSync(importHeight, 'utf8'))
    } else {
      heightOriginal = 0
    }
    heightWork = heightOriginal
    console.log('Batch: ' + heightWork)
    let txns = 'BEGIN;\n'
    txns += 'INSERT INTO transactions ("id", "block", "timestamp", "hash") VALUES\n'
    let topics = 'BEGIN;\n'
    topics += 'INSERT INTO topic ("id", "parent", "account") VALUES\n'

    while (heightWork < blockHeight) {
      const top = heightWork + chunkSize - 1
      const blocks = await dbTransactions.getAllInBlockRange(heightWork, top)
      for (let i = 0; i < blocks.length; i++) {
        txns += '(' + blocks[i].id + ', ' + blocks[i].block + ', ' + blocks[i].timestamp + ', \'' + blocks[i].hash + '\'),\n'
      }
      const highIdQ = await dbCommon.query('SELECT id FROM topic WHERE parent = (SELECT id FROM transactions WHERE block <= ' + top + ' ORDER BY id DESC LIMIT 1) ORDER BY id DESC LIMIT 1')
      if (highIdQ.rows.length > 0) { // if this is null its because we are less than the first transaction
        const lowIdQ = await dbCommon.query('SELECT id FROM topic WHERE parent = (SELECT id FROM transactions WHERE block >= ' + heightWork + ' ORDER BY id ASC LIMIT 1) ORDER BY id ASC LIMIT 1')
        const topicsArr = await dbCommon.query('SELECT id, parent, encode("account", \'escape\') AS "account" FROM topic WHERE id >= ' + lowIdQ.rows[0].id + ' AND id <= ' + highIdQ.rows[0].id + 'ORDER BY "parent"')
        topicsArr.rows.forEach((t) => {
          topics += '(' + t.id + ', ' + t.parent + ', \'' + t.account + '\'),\n'
        })
      }
      const full = isFull(topics, txns)
      heightWork += chunkSize
      if (full) {
        write = txns.slice(0, txns.length - 2)
        write += ';\n'
        write += 'COMMIT;\n\n'
        write += topics.slice(0, topics.length - 2)
        write += ';\n'
        write += 'COMMIT;\n'
        const filePath = kickstartDir + top + '_blocks.sql'
        fs.writeFileSync(filePath, write)
        log(top + '_blocks.sql written to: ' + filePath, 1)
        fs.writeFileSync(importHeight, String(heightWork))
        await extractData()
      }
    }
  } catch (error) {
    logError(error)
  }
}

/* 
  returns true if the sum of the JSON objects are greater than the fileSizeMax
*/
const isFull = (topic, transactions) => {
  const sizetopic = topic.length
  const sizeTransactions = transactions.length
  const sum = sizetopic + sizeTransactions
  if (sum >= fileSizeMax) {
    return true
  }
  return false
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
      const message = 'This will export the entire database into sql files as well as the index cache file.\n this operation may take a while to complete.\nExport data?'
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

