const c = require('./common.js');

module.exports = {

  // TODO - make this a redis cached call
  getAll: async (routeHandler) => {
    try {
      const q = 'SELECT "id", "profileId", "routeHandler", "reference", "routeMeta" FROM subscriptions WHERE "routeHandler" = $1'
      const result = await c.query(q, [routeHandler])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  get: async (profileId) => {
    try {
      const q = 'SELECT "id", "profileId", "routeHandler", "reference", "routeMeta" FROM subscriptions WHERE "profileId" = $1'
      const result = await c.query(q, [profileId])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  getDetail: async (profileId, reference) => {
    try {
      const q = 'SELECT "id", "profileId", "routeHandler", "reference", "routeMeta" FROM subscriptions WHERE "profileId" = $1 AND "reference" = $2'
      const result = await c.query(q, [profileId, reference])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  add: async (profileId, routeHandler, reference, routeMeta) => {
    try {
      const q = 'INSERT INTO subscriptions("profileId", "routeHandler", "reference", "routeMeta") VALUES ($1, $2, $3, $4) RETURNING id'
      const result = await c.query(q, [profileId, routeHandler, reference, routeMeta])
      return result.rows[0].id
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  drop: async (profileId, reference) => {
    try {
      const q = 'DELETE FROM subscriptions WHERE "profileId" = $1 AND "reference" = $2 RETURNING id'
      const result = await c.query(q, [profileId, reference])
      if (result.rows.length > 0) return result.rows[0].id
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

}