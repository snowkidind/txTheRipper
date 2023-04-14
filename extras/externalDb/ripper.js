
// basic PG wrapper

const { Pool, types } = require('pg');
types.setTypeParser(1114, function (stringValue) {
  return stringValue;
});

let pool

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
      throw "There was an error in common.js: " + e;
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
  }
};

function initPool() {
  _pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.RIPPER_DB_NAME,
    password: process.env.DB_PASS,
  });
  pool = _pool
  _pool.on('error', (error, client) => {
    console.log('Common.js - Unexpected database error:')
    console.log(error)
    // process.exit(-1)
  })
}
