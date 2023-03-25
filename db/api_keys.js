const c = require('./common.js');

module.exports = {
  get: async (apiKey) => {
    try {
      const q = 'SELECT "profileId", "apiKey", "deliveryMethod" FROM api_keys WHERE "apiKey" = $1'
      const result = await c.query(q, [apiKey])
      return result.rows[0]
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  profileKeys: async (profileId) => {
    try {
      const q = 'SELECT "profileId", "apiKey", "deliveryMethod" FROM api_keys WHERE "profileId" = $1'
      const result = await c.query(q, [profileId])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  }
}
