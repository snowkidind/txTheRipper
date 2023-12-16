const c = require('./common.js')
const { log, logError } = require('../utils/log')

module.exports = {

  getBool: async (field) => {
    try {
      const q1 = 'SELECT value_bool FROM application_data WHERE field = $1'
      const result = await c.query(q1, [field])
      if (result.rows.length > 0) return result.rows[0].value_bool
    } catch (error) {
      logError(error, 'Database Error:getBool')
    }
  },

  setBool: async (field, value) => {
    try {
      const q1 = 'SELECT value_bool FROM application_data WHERE field = $1'
      const result1 = await c.query(q1, [field])
      if (result1.rows.length === 0) {
        const q2 = 'INSERT INTO application_data ("field", "value_bool") VALUES ($1, $2)'
        await c.query(q2, [field, value])
      } else {
        const q3 = 'UPDATE application_data SET "value_bool" = $1 WHERE "field" = $2'
        await c.query(q3, [value, field])
      }
      const result2 = await c.query(q1, [field])
      return result2.rows[0].value_bool
    } catch (error) {
      logError(error, 'Database Error:setBool')
    }
  },

  getInt: async (field) => {
    try {
      const q1 = 'SELECT value_int FROM application_data WHERE field = $1'
      const result = await c.query(q1, [field])
      if (result.rows.length > 0) return Number(result.rows[0].value_int)
    } catch (error) {
      logError(error, 'Database Error:getInt')
    }
  },

  setInt: async (field, value) => {
    try {
      const q1 = 'SELECT value_int FROM application_data WHERE field = $1'
      const result1 = await c.query(q1, [field])
      if (result1.rows.length === 0) {
        const q2 = 'INSERT INTO application_data ("field", "value_int") VALUES ($1, $2)'
        await c.query(q2, [field, value])
      } else {
        const q3 = 'UPDATE application_data SET "value_int" = $1 WHERE "field" = $2'
        await c.query(q3, [value, field])
      }
      const result2 = await c.query(q1, [field])
      return result2.rows[0].value_int
    } catch (error) {
      logError(error, 'Database Error:setInt')
    }
  },


  getString: async (field) => {
    try {
      const q1 = 'SELECT value_string FROM application_data WHERE field = $1'
      const result = await c.query(q1, [field])
      if (result.rows.length > 0) return result.rows[0].value_string
    } catch (error) {
      logError(error, 'Database Error:getString')
    }
  },

  setString: async (field, value) => {
    try {
      const q1 = 'SELECT value_string FROM application_data WHERE field = $1'
      const result1 = await c.query(q1, [field])
      if (result1.rows.length === 0) {
        const q2 = 'INSERT INTO application_data ("field", "value_string") VALUES ($1, $2)'
        await c.query(q2, [field, value])
      } else {
        const q3 = 'UPDATE application_data SET "value_string" = $1 WHERE "field" = $2'
        await c.query(q3, [value, field])
      }
      const result2 = await c.query(q1, [field])
      return result2.rows[0].value_string
    } catch (error) {
      logError(error, 'Database Error:setString')
    }
  },

  markPaused: async () => {
    try {
      const q1 = 'SELECT value_bool FROM application_data WHERE field = \'pause\''
      const result1 = await c.query(q1)
      if (result1.rows.length === 0) {
        const q2 = 'INSERT INTO application_data ("field", "value_bool") VALUES (\'pause\', true)'
        await c.query(q2)
      } else {
        const q3 = 'UPDATE application_data SET "value_bool" = true WHERE field = \'pause\''
        await c.query(q3)
      }
      const result2 = await c.query(q1)
      return { newStatus: result2.rows[0].value_bool } 
    } catch (error) {
      logError(error, 'Database Error:markPaused')
    }
  },

  markUnPaused: async () => {
    try {
      const q1 = 'SELECT value_bool FROM application_data WHERE field = \'pause\''
      const result1 = await c.query(q1)
      if (result1.rows.length === 0) {
        const q2 = 'INSERT INTO application_data ("field", "value_bool") VALUES (\'pause\', false)'
        await c.query(q2)
      } else {
        const q3 = 'UPDATE application_data SET "value_bool" = false WHERE field = \'pause\''
        await c.query(q3)
      }
      const result2 = await c.query(q1)
      return { newStatus: result2.rows[0].value_bool }
    } catch (error) {
      logError(error, 'Database Error:markUnpaused')
    }
  },

  pauseStatus: async () => {

    try {
      const q1 = 'SELECT value_bool FROM application_data WHERE field = \'pause\''
      const result = await c.query(q1)
      if (result.rows.length > 0) return result.rows[0].value_bool
    } catch (error) {
      logError(error, 'Database Error:pauseStatus')
    }
  },

  getLastTableRowInsert: async (table) => {
    try {
      const q = 'SELECT value_int FROM application_data WHERE field = $1'
      const result = await c.query(q, [table])
      return result.rows[0].value_int
    } catch (error) {
      logError(error, 'Database Error:getLastTableRowInsert')
    }
  },

  setLastTableRowInsert: async (table, row) => {
    try {
      const q1 = 'SELECT value_int FROM application_data WHERE field = $1'
      const result1 = await c.query(q1, [table])
      if (result1.rows.length === 0) {
        const q2 = 'INSERT INTO application_data ("field", "value_int") VALUES ($1, $2)'
        await c.query(q2, [table, row])
      } else {
        const q3 = 'UPDATE application_data SET "value_int" = $1 WHERE field = $2'
        await c.query(q3, [row, table])
      }
      const result2 = await c.query(q1)
      return { newStatus: result2.rows[0].value_int }
    } catch (error) {
      logError(error, 'Database Error:setLastTableRowInsert')
    }
  },

  getLastIndexId: async () => {
    try {
      const q = 'SELECT value_int FROM application_data WHERE field = \'indexId\''
      const result = await c.query(q)
      if (result.rows.length > 0) return result.rows[0].value_int
    } catch (error) {
      logError(error, 'Database Error:getLastIndexId')
    }
  },

  setLastIndexId: async (last) => {
    try {
      const q1 = 'SELECT value_int FROM application_data WHERE field = \'indexId\''
      const result1 = await c.query(q1)
      if (result1.rows.length === 0) {
        const q2 = 'INSERT INTO application_data ("field", "value_int") VALUES (\'indexId\', $1)'
        await c.query(q2, [last])
      } else {
        const q3 = 'UPDATE application_data SET "value_int" = $1 WHERE field = \'indexId\''
        await c.query(q3, [last])
      }
      const result2 = await c.query(q1)
      return { newStatus: result2.rows[0].value_int }
    } catch (error) {
      logError(error, 'Database Error:setLastIndexId')
    }
  },
}