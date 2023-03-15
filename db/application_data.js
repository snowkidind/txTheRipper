const c = require('./common.js')

module.exports = {

  markPaused: async () => {
    try {
      const q1 = 'SELECT value_bool FROM application_data WHERE field = \'pause\''
      const result1 = await c.query(q1)
      console.log('NOTICE: Marking Paused')
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
      console.log(error)
    }
  },

  markUnPaused: async () => {
    try {
      const q1 = 'SELECT value_bool FROM application_data WHERE field = \'pause\''
      const result1 = await c.query(q1)
      console.log('NOTICE: Marking Unpaused')
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
      console.log(error)
    }
  },

  pauseStatus: async () => {
    try {
      const q1 = 'SELECT value_bool FROM application_data WHERE field = \'pause\''
      const result = await c.query(q1)
      if (result.rows.length > 0) return result.rows[0].value_bool
    } catch (error) {
      console.log(error)
    }
  },

  setLastBlockSynced: async (lastBlock) => {
    try {
      const q1 = 'SELECT value_int FROM application_data WHERE field = \'block_sync\''
      const result1 = await c.query(q1)
      if (result1.rows.length === 0) {
        const q2 = 'INSERT INTO application_data ("field", "value_int") VALUES (\'block_sync\', $1)'
        await c.query(q2, [lastBlock])
      } else {
        const q3 = 'UPDATE application_data SET "value_int" = $1 WHERE field = \'block_sync\''
        await c.query(q3, [lastBlock])
      }
      const result2 = await c.query(q1)
      return { newStatus: result2.rows[0].value_int }
    } catch (error) {
      console.log(error)
    }
  },

  getLastBlockSynced: async () => {
    try {
      const q1 = 'SELECT value_int FROM application_data WHERE field = \'block_sync\''
      let result = await c.query(q1)
      if (result.rows.length === 0) {
        const q2 = 'INSERT INTO application_data (value_int, field) VALUES (0, \'block_sync\')'
        const result2 = await c.query(q2)
        result = await c.query(q1)
      }
      if (result.rows.length > 0) return { newStatus: result.rows[0].value_int }

    } catch (error) {
      console.log(error)
    }
  },

  getLastTableRowInsert: async (table) => {
    try {
      const q = 'SELECT value_int FROM application_data WHERE field = $1'
      const result = await c.query(q, [table])
      return result.rows[0].value_int
    } catch (error) {
      console.log(error)
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
      console.log(error)
    }
  },

  getLastIndexId: async () => {
    try {
      const q = 'SELECT value_int FROM application_data WHERE field = \'indexId\''
      const result = await c.query(q)
      if (result.rows.length > 0) return result.rows[0].value_int
    } catch (error) {
      console.log(error)
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
      console.log(error)
    }
  },
}