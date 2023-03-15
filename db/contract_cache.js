const c = require('./common.js')

module.exports = {
  cacheSize: async (parent, account) => {
    try {
      const q = 'SELECT COUNT(id) FROM contract_cache'
      const result = await c.query(q)
      return result.rows[0].count
    } catch (error) {
      console.log(error)
    }
  },

  getCache: async (limit) => {
    const q = 'SELECT account, "byteId" FROM contract_cache ORDER BY WEIGHT DESC LIMIT $1'
    const result = await c.query(q, [limit])
    result.rows.map((row) => {
      row.account = row.account.toString()
      row.byteId = row.byteId.toString()
    })
    return result.rows
  }
}