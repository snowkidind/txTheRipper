const { Pool, types } = require('pg')
types.setTypeParser(1114, function (stringValue) {
  return stringValue
})
const { log, logError } = require('../utils/log')

let pool
let dispRaiseNotice = false

module.exports = {

  client: async () => {
    try {
      if (typeof (pool) === 'undefined') initPool()
      const client = await pool.connect()
      return {
        client: client,
        begin: (async () => {
          await client.query('BEGIN')
        }),
        commit: (async () => {
          await client.query('COMMIT')
          client.release()
        }),
        rollback: (async () => {
          await client.query('ROLLBACK')
          client.release()
        }),
        showRaiseNotice: (thisClient) => {
          thisClient.on('notice', (notice) => {
            console.log(notice.message)
          })
        }
      }
    } catch (error) {
      logError(error, 'Database Error')
      throw "There was an error in common.js"
    }
  },

  pool: function () {
    try {
      if (typeof (pool) === 'undefined') {
        initPool();
      }
      return pool;
    } catch (e) {
      throw "Could not connect to the pool: " + e;
    }
  },

  query: (query, queryValues) => {
    return new Promise((resolve, reject) => {
      try {
        if (typeof pool === 'undefined') {
          initPool()
        }
        pool.query(query, queryValues, (err, res) => {
          if (err) {
            reject(err)
          } else {
            resolve(res)
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  },

  validResponse: (val) => {
    if (typeof val !== 'undefined' && Array.isArray(val.rows) && val.rows.length > 0) {
      return true
    }
    return false
  },

  showTables: async () => {
    try {
      const q = 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\''
      const result = await module.exports.query(q)
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  showIndexes: async (table) => {
    const q = 'SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1;'
    const result = await module.exports.query(q, [table])
    return result.rows
  }
}

function initPool() {
  _pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
  });
  pool = _pool
  _pool.on('error', (error, client) => {
    log('Common.js - Unexpected database error:', 1)
    logError(error, 'Database Error')
    // process.exit(-1)
  })
}

function callbacks(client) {

  // these will cause "memory leak conditions" warnings when many requests, 
  // because it takes a little bit for pg to give back the handle and end
  // doesnt seem to care as much about the non error listeners.

  client.on('error', (error) => {
    log('An error occurred with db client:', 1)
    logError(error, 'Database Error')
  })

  // for debugging - observe the handle ending
  client.on('end', (end) => {
    log('pg_client: end', 1)
  })

  return client
}