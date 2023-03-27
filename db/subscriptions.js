const c = require('./common.js');
const { log, logError } = require('../utils/log')

module.exports = {
  
  getAllEnabled: async (routeHandler) => {
    try {
      // this q also ensures the user is not disabled
      const q = `
      SELECT s."id", s."profileId", s."enabled", s."routeHandler", s."reference", s."routeMeta", s."deliveryMethod", p."status" 
      FROM subscriptions s 
      INNER JOIN profiles p 
      ON s."profileId" = p.id 
      AND s."routeHandler" = $1 
      AND s."enabled" = true 
      AND p."status" = 'enabled';
      `
      const result = await c.query(q, [routeHandler])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  getAll: async (routeHandler, deliveryMethod) => {
    try {
      // this q also ensures the user is not disabled
      const q = `
      SELECT s."id", s."profileId", s."enabled", s."routeHandler", s."reference", s."routeMeta", s."deliveryMethod", p."status" 
      FROM subscriptions s 
      INNER JOIN profiles p 
      ON s."profileId" = p.id 
      AND s."routeHandler" = $1 
      AND s."deliveryMethod" = $2 
      AND s."enabled" = true 
      AND p."status" = 'enabled';
      `
      const result = await c.query(q, [routeHandler, deliveryMethod])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  get: async (profileId) => {
    try {
      const q = 'SELECT "id", "profileId", "enabled", "routeHandler", "reference", "routeMeta", "deliveryMethod" FROM subscriptions WHERE "profileId" = $1 ORDER BY id ASC'
      const result = await c.query(q, [profileId])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  getDeliveryMethod: async (profileId, deliveryMethod) => {
    try {
      const q = 'SELECT "id", "profileId", "enabled", "routeHandler", "reference", "routeMeta", "deliveryMethod" FROM subscriptions WHERE "profileId" = $1 AND "deliveryMethod" = $2 AND "enabled" = true ORDER BY id ASC'
      const result = await c.query(q, [profileId, deliveryMethod])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  getDetail: async (profileId, reference) => {
    try {
      const q = 'SELECT "id", "profileId", "enabled", "routeHandler", "reference", "routeMeta", "deliveryMethod" FROM subscriptions WHERE "profileId" = $1 AND "reference" = $2'
      const result = await c.query(q, [profileId, reference])
      return result.rows
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  add: async (profileId, routeHandler, reference, routeMeta, deliveryMethod) => {
    try {
      const q = 'INSERT INTO subscriptions("profileId", "enabled", "routeHandler", "reference", "routeMeta", "deliveryMethod") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id'
      const result = await c.query(q, [profileId, true, routeHandler, reference, routeMeta, deliveryMethod])
      return result.rows[0].id
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  drop: async (profileId, reference, deliveryMethod) => {
    try {
      const q = 'DELETE FROM subscriptions WHERE "profileId" = $1 AND "reference" = $2 AND "deliveryMethod" = $3 RETURNING id'
      const result = await c.query(q, [profileId, reference, deliveryMethod])
      if (result.rows.length > 0) return result.rows[0].id
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  disable: async (id) => {
    try {
      const q = 'UPDATE subscriptions SET "enabled" = false WHERE id = $1 returning enabled'
      const result = await c.query(q, [id])
      if (result.rows.length > 0) return result.rows[0].enabled
    } catch (error) {
      logError(error, 'Database Error')
    }
  },

  enable: async (id) => {
    try {
      const q = 'UPDATE subscriptions SET "enabled" = true WHERE id = $1 returning enabled'
      const result = await c.query(q, [id])
      if (result.rows.length > 0) return result.rows[0].enabled
    } catch (error) {
      logError(error, 'Database Error')
    }
  }

}