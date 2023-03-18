const c = require('./common.js')

module.exports = {
  newTopic: async (parent, account) => {
    try {
      const q = 'INSERT INTO topic ("parent", "account") VALUES ($1, $2)  RETURNING id'
      const result = await c.query(q, [parent, account])
      if (result.rows.length > 0) {
        return result.rows[0].id
      }
    } catch (error) {
      console.log(error)
    }
  },

  txCount: async (account) => {
    try {
      const q = 'SELECT COUNT(account) FROM topic WHERE account = $1'
      const result = await c.query(q, [account])
      if (result.rows.length > 0) {
        return result.rows[0].count
      }
    } catch (error) {
      console.log(error)
    }
  },

  getTopicsForParent: async (parentId) => { 
    try {
      const q = 'SELECT id, translate(account) AS account FROM topic WHERE parent = $1'
      const result = await c.query(q, [parentId])
      if (result.rows.length > 0) {
        return result.rows
      }
    } catch (error) {
      console.log(error)
    }
  }

}