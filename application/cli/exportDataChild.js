const env = require('node-env-file')
env(__dirname + '/../../.env')

const fs = require('fs')
const { dbAppData, dbTransactions, dbCommon } = require('../../db/index.js')
const { log, logError } = require('../../utils/log.js')
const { memStatsOneLine } = require('../../utils/system.js')

const kickstartDir = process.env.KICKSTARTDIR
const fileSizeMax = Number(process.env.JSON_TX_FILE_MAX) || 300000000
const importHeight = kickstartDir + 'importHeight'

// number of blocks to pull from sql in a single query
//   if this is too large, Node will not be able to compose the string to write the sql query.
const chunkSize = 500
let heightWork

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

const extractData = async () => {

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
        let write = txns.slice(0, txns.length - 2)
        write += ';\n'
        write += 'COMMIT;\n\n'
        write += topics.slice(0, topics.length - 2)
        write += ';\n'
        write += 'COMMIT;\n'
        const filePath = kickstartDir + top + '_blocks.sql'
        fs.writeFileSync(filePath, write)
        log('Peak:')
        memStatsOneLine() // at peak of mem usage
        write = ''
        log(top + '_blocks.sql written to: ' + filePath, 1)
        fs.writeFileSync(importHeight, String(heightWork))
        break
      }
    }
    return
}

(async () => {
  try {
    await extractData()
  } catch (error) {
    logError(error)
  }
  process.exit()
})()