const c = require('./common.js');

module.exports = {

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