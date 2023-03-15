const { exec } = require('child_process')
const fs = require('fs')
const c = require('./common.js')
const { log } = require('../utils/log')
const appData = require('./application_data.js')
const contractCache = require('./contract_cache.js')
const schemaDir = process.env.BASEPATH + '/db/schema/'
const appDataDir = process.env.BASEPATH + '/derived/application/'
const popularDir = process.env.BASEPATH + '/derived/popular/'

module.exports = {

  initApplicationDefaults: async () => {
    log('NOTICE: Initializing Application Defaults...', 1)
    if (typeof (await appData.pauseStatus()) === 'undefined') {
      await appData.markUnPaused()
    }
  },

  initTables: async () => {
    const tables = await c.showTables()
    const db = {
      topic: false,
      transactions: false,
      application_data: false,
      contract_cache: false
    }
    let count = 0
    tables.forEach((t) => {
      for (table in db) {
        if (t.table_name === table) {
          db[table] = true
          count += 1
        }
      }
    })
    if (count === 0) {
      log('NOTICE: Initializing database...', 1)
      await execSqlFile(schemaDir + 'schema_pre.sql')
    } else if (count < 4) {
      let message = 'ERROR: Not all database tables were found. ' + count + ' of ' + Object.keys(db).length + '\n'
      for (table in db) {
        message += table + ': ' + db[table] + '\n'
      }
      log('Database Tables', 4, db)
      process.exit(1)
    }
    log('NOTICE: Tables are initialized.', 1)
    return true
  },

  checkPartitions: async (block) => {
    await module.exports.initPartitions(block)
  },

  initPartitions: async (block) => {
    log('NOTICE: Assessing partitions.', 1)
    const transactionsSql = async () => { // transactions table - partition every 500k blocks
      const partitions = Math.ceil(block / 500000) + 7 // add 2 partitions pro bono
      const tables = await c.showTables()
      let count = 0
      tables.forEach((table) => {
        if (table.table_name.startsWith('transactions_')) count += 1
      })
      if (count < partitions) {
        const gen = partitions - count
        log('Not enough Partitions for transactions table, have ' + count + ' need: ' + partitions + ' Generating: ' + gen + ' partitions', 1)
        let sql = 'BEGIN;\n'
        let range = count * 500000
        for (let i = 0; i < gen; i++) {
          const to = range + 500000
          const id = i + 1 + count
          sql += 'CREATE TABLE transactions_' + range + '_p' + id + ' PARTITION OF transactions FOR VALUES FROM (' + range + ') TO (' + to + ');\n'
          range += 500000
        }
        sql += 'COMMIT;\n'
        return sql
      }
    }
    const topicSql = async () => {
      // TODO get size of highest topic table and if > 0 create some new partitions
      // topics table - partition every 250m addresses

      let maxTopics = 10000000000 // A valid hack to get more partitions would be to just increase this number
      // TODO: ensure partitions arent encroaching on max topics

      const topicRange = 250000000
      const partitions = maxTopics / topicRange // 40
      const tables = await c.showTables()
      let count = 0
      tables.forEach((table) => {
        if (table.table_name.startsWith('topic_')) count += 1
      })
      if (count < partitions) {
        const gen = partitions - count
        log('Not enough Partitions for topic table, have ' + count + ' need: ' + partitions + ' Generating: ' + gen + ' partitions', 1)
        let sql = 'BEGIN;\n'
        let range = count * topicRange
        for (let i = 0; i < gen; i++) {
          const to = range + topicRange
          const id = i + 1 + count
          sql += 'CREATE TABLE topic_' + range + '_p' + id + ' PARTITION OF topic FOR VALUES FROM (' + range + ') TO (' + to + ');\n'
          range += topicRange
        }
        sql += 'COMMIT;\n'
        return sql
      }
    }
    const transactions = await transactionsSql()
    const topic = await topicSql()
    let sqlFile = ''
    if (typeof transactions !== 'undefined') {
      sqlFile += transactions 
      sqlFile += '\n'
    }
    if (typeof topic !== 'undefined') {
      sqlFile += topic 
    }
    if (sqlFile === '') return
    log('NOTICE: adding partitions to database...')
    fs.writeFileSync(appDataDir + 'partition.sql', sqlFile)
    await execSqlFile(appDataDir + 'partition.sql')
    fs.rmSync(appDataDir + 'partition.sql')
  },

  assignPopularAddresses: async () => {
    const size = await contractCache.cacheSize()
    if (size > 0) {
      log('NOTICE: The contract cache was previously initialized.', 2)
      return // the contract cache was already initialized...
    }
    const accountsFile = popularDir + 'topAccts.json'
    const _accounts = fs.readFileSync(accountsFile)
    let accounts = JSON.parse(_accounts)
    if (accounts.length === 0) {
      log('ERROR: No popular Accounts', 1)
      process.exit()
    }
    const removeDuplicates = (accts) => { // accounts file may not contain duplicates
      const accountsBuild = []
      accountsBuild[0] = accts[0]
      for (let i = 0; i < accts.length; i++) {
        let add = true
        if (accts[i].count < 9) {
          add = false
        } else {
          for (let j = 0; j < accountsBuild.length; j++) {
            if (accountsBuild[j].account === accts[i].account) {
              add = false
            }
          }
        }
        if (add) {
          accountsBuild.push(accts[i])
        }
      }
      return accountsBuild
    }
    log('NOTICE: Searching for duplicates and filtering before inserting... ' + accounts.length + ' to filter', 1)
    accounts = removeDuplicates(accounts)
    log('NOTICE: Filtered accounts: ' + accounts.length, 1)
    let id = await appData.getLastIndexId() 
    if (typeof id === 'undefined') {
      await appData.setLastIndexId(0)
      id = 0
    }
    let sql = 'BEGIN;\n'
    sql += 'INSERT INTO contract_cache ("byteId", "account", "weight") VALUES\n'
    let byteId
    let actual = 0
    for (let i = 0; i < accounts.length; i++) {
      if (accounts[i].count < 9) continue
      actual += 1
      id += 1
      byteId = id.toString(16)
      sql += '(\'0x' + byteId + '\', \'' + accounts[i].account + '\',' + accounts[i].count + '),\n'
      //  if (i > 45) i = accounts.length
    }
    sql = sql.substring(0, sql.length - 2) + ';\n'
    sql += 'UPDATE application_data SET "value_int" = ' + id + ' WHERE field = \'indexId\';\n'
    sql += 'COMMIT;\n'
    log('NOTICE: adding ' + actual + ' account indexes to database...', 1)
    fs.writeFileSync(appDataDir + 'accountIndexes.sql', sql)
    await execSqlFile(appDataDir + 'accountIndexes.sql')
    fs.rmSync(appDataDir + 'accountIndexes.sql')
  }
}

const execSqlFile = (fullPath) => {
  return new Promise((resolve) => {
    exec('psql -d ' + process.env.DB_NAME + ' -f ' + fullPath, (error, stdout, stderr) => {
      if (error) { log(error.message) }
      if (stderr) { log(stderr) }
      log(stdout.replace(/\n*$/, ""))
      resolve()
    })
  })
}