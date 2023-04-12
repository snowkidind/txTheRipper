const ripperDb = require('./ripper.js')

// Add/Remove subscriptions to ripper database

module.exports = {
  addAccountSubscription: async (account, meta) => {
    const q1 = 'SELECT * FROM subscriptions WHERE reference = $1'
    const r1 = await ripperDb.query(q1, [account.toLowerCase()])
    if (r1.rows.length > 0) {
      const message = 'Already added: ' + account
      return { status: 'ok', message: message }
    }
    const q2 = 'INSERT INTO subscriptions("profileId", "enabled", "routeHandler", "reference", "routeMeta", "deliveryMethod") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id'
    const r2 = await ripperDb.query(q2, [1, true, 'accounts', account.toLowerCase(), meta, 'unix_socket'])
    if (r2.rows.length > 0) {
      const message = 'Inserted ' + account.toLowerCase() + ' to row: ' + r2.rows[0].id
      return { status: 'ok', message: message }
    }
  },

  removeAccountSubscription: async (account) => {
    const q1 = 'SELECT id FROM subscriptions WHERE reference = $1'
    const r1 = await ripperDb.query(q1, [account.toLowerCase()])
    if (r1.rows.length > 0) {
      const q2 = 'DELETE FROM subscriptions where id = $1 RETURNING id'
      const r2 = await ripperDb.query(q2, [r1.rows[0].id])
      if (r2.rows.length > 0) return { status: 'ok', message: 'Removed: ' + r2.rows[0].id }
      return { status: 'ok', message: 'Could not remove row, not found' }
    }
  },

  getAccountSubscription: async (account) => {
    const q1 = 'SELECT * FROM subscriptions WHERE reference = $1'
    const r1 = await ripperDb.query(q1, [account.toLowerCase()])
    if (r1.rows.length > 0) return r1.rows[0]
  },

  getAllSubscriptionsForProfile: async (identifier) => {
    const q1 = 'SELECT id from profiles where identifier = $1'
    const r1 = await ripperDb.query(q1, [identifier])
    if (r1.rows.length > 0) {
      const q = 'SELECT "id", "profileId", "enabled", "routeHandler", "reference", "routeMeta", "deliveryMethod" FROM subscriptions WHERE "profileId" = $1 ORDER BY id ASC'
      const result = await ripperDb.query(q, [r1.rows[0].id])
      return result.rows
    }
  }
}


// Note the meta will be used to differentiate the way the subscription is processed
// 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f  // uniswap v2 deployer
// ;(async () => {
//   const result = await module.exports.addAccountSubscription('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', { type: 'all', source: 'uniswapV2Deployer' })
//   console.log(result)
//   process.exit()
// })()