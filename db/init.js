const { exec } = require('child_process')
const fs = require('fs')
const c = require('./common.js')
const appData = require('./application_data.js')
const contractCache = require('./contract_cache.js')
const schemaDir = process.env.BASEPATH + '/db/schema/'
const appDataDir = process.env.BASEPATH + '/derived/application/'
const popularDir = process.env.BASEPATH + '/derived/popular/'

module.exports = {

  initApplicationDefaults: async () => {
    console.log('NOTICE: Initializing Application Defaults...')
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
      console.log('NOTICE: Initializing database...')
      await execSqlFile(schemaDir + 'schema_pre.sql')
    } else if (count < 4) {
      let message = 'ERROR: Not all database tables were found. ' + count + ' of ' + Object.keys(db).length + '\n'
      for (table in db) {
        message += table + ': ' + db[table] + '\n'
      }
      console.log(db)
      process.exit(1)
    }
    console.log('NOTICE: Tables are initialized.')
    return true
  },

  initPartitions: async (block) => {
    console.log('NOTICE: Assessing partitions.')
    const transactionsSql = async () => { // transactions table - partition every 500k blocks
      const partitions = Math.ceil(block / 500000) + 7 // add 2 partitions pro bono
      const tables = await c.showTables()
      let count = 0
      tables.forEach((table) => {
        if (table.table_name.startsWith('transactions_')) count += 1
      })
      if (count < partitions) {
        const gen = partitions - count
        console.log('Not enough Partitions for transactions table, have ' + count + ' need: ' + partitions + ' Generating: ' + gen + ' partitions')
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
      const topicRange = 250000000
      const maxTopics = 10000000000 // A valid hack to get more partitions would be to just increase this number
      const partitions = maxTopics / topicRange // 40
      const tables = await c.showTables()
      let count = 0
      tables.forEach((table) => {
        if (table.table_name.startsWith('topic_')) count += 1
      })
      if (count < partitions) {
        const gen = partitions - count
        console.log('Not enough Partitions for topic table, have ' + count + ' need: ' + partitions + ' Generating: ' + gen + ' partitions')
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
    console.log('NOTICE: adding partitions to database...')
    fs.writeFileSync(appDataDir + 'partition.sql', sqlFile)
    await execSqlFile(appDataDir + 'partition.sql')
    fs.rmSync(appDataDir + 'partition.sql')
  },

  assignPopularAddresses: async () => {
    const size = await contractCache.cacheSize()
    if (size > 0) {
      console.log('NOTICE: The contract cache was previously initialized.')
      return // the contract cache was already initialized...
    }
    const accountsFile = popularDir + 'topAccts.json'
    const _accounts = fs.readFileSync(accountsFile)
    let accounts = JSON.parse(_accounts)
    if (accounts.length === 0) {
      console.log('No popular Accounts')
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
    console.log('NOTICE: Searching for duplicates and filtering before inserting... ' + accounts.length + ' to filter')
    accounts = removeDuplicates(accounts)
    console.log('NOTICE: Filtered accounts: ' + accounts.length)
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
    console.log('NOTICE: adding ' + actual + ' account indexes to database...')
    fs.writeFileSync(appDataDir + 'accountIndexes.sql', sql)
    await execSqlFile(appDataDir + 'accountIndexes.sql')
    fs.rmSync(appDataDir + 'accountIndexes.sql')
  }
}

const execSqlFile = (fullPath) => {
  return new Promise((resolve) => {
    exec('psql -d ' + process.env.DB_NAME + ' -f ' + fullPath, (error, stdout, stderr) => {
      if (error) { console.log(error.message) }
      if (stderr) { console.log(stderr) }
      console.log(stdout.replace(/\n*$/, ""))
      resolve()
    })
  })
}
