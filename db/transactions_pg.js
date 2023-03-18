const c = require('./common.js')

module.exports = {
  newTransaction: async (block, timestamp, hash) => {
    try {
      const q = 'INSERT INTO transactions ("block", "timestamp", "hash") VALUES ($1, $2, $3)  RETURNING id'
      const result = await c.query(q, [block, timestamp, hash])
      if (result.rows.length > 0) {
        return result.rows[0].id
      }
    } catch (error) {
      console.log(error)
    }
  },

  getTransactionHeaders: async (hash) => {
    const q = 'SELECT id, block, timestamp FROM transactions WHERE hash = $1'
    const result = await c.query(q, [hash])
    return result.rows
  }
}