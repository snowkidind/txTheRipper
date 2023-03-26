const c = require('./common.js');
const { log, logError } = require('../utils/log')

module.exports = {

  new: async (identifier, status) => {
    try {
      const q = 'INSERT INTO profiles ("identifier", "status") VALUES ($1, $2) RETURNING id'
      const result = await c.query(q, [identifier, status])
      return result.rows[0].id
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  all: async () => {
    try {
      const q = 'SELECT "id", "status", "identifier" FROM profiles'
      const result = await c.query(q)
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  get: async (id) => {
    try {
      const q = 'SELECT "id", "status", "identifier" FROM profiles WHERE "id" = $1'
      const result = await c.query(q, [id])
      return result.rows[0]
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  getByIdentifier: async (identifier) => {
    try {
      const q = 'SELECT "id", "status", "identifier" FROM profiles WHERE "identifier" = $1'
      const result = await c.query(q, [identifier])
      return result.rows[0]
    } catch (error) {
      logError(error, 'Database Error')
    }
  }
}