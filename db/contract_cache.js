const c = require('./common.js')
const { log, logError } = require('../utils/log')

module.exports = {
  cacheSize: async (parent, account) => {
    try {
      const q = 'SELECT COUNT(id) FROM contract_cache'
      const result = await c.query(q)
      return result.rows[0].count
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  getAllCache: async () => {
    const q = 'SELECT id, encode("byteId", \'escape\') AS "byteId", encode("account", \'escape\') AS "account", weight FROM contract_cache ORDER BY id ASC'
    const result = await c.query(q)
    result.rows.map((row) => {
      row.id = row.id
      row.byteId = row.byteId.toString()
      row.account = row.account.toString()
      row.weight = row.weight
    })
    return result.rows
  },

  getCache: async (limit) => {
    const q = 'SELECT account, "byteId" FROM contract_cache ORDER BY WEIGHT DESC LIMIT $1'
    const result = await c.query(q, [limit])
    result.rows.map((row) => {
      row.account = row.account.toString()
      row.byteId = row.byteId.toString()
    })
    return result.rows
  },

  // Short to long
  translateS2L: async (short) => {
    try {
      const q = 'SELECT encode(account, \'escape\') AS account FROM contract_cache WHERE "byteId" = $1'
      const result = await c.query(q, [short])
      if (result.rows.length > 1) log('WARNING: Found more than one account for short code:' + short, 1)
      return result.rows[0]
    } catch (error) {
      logError(error, 'Database Error')
    }
  }
}