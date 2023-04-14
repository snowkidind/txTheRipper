const r = require('./ripper.js')

// Note there are two functions that help things along 
// Because if the contract_cache table there needs to be a translate function 
// in order to get a human readable hexidecimal address or hash. Also, since 
// the database is stored using BYTEA, we must set the output of these to escape as such:
// SET bytea_output = 'escape';

// topics are externally owned accounts and contract accounts. They are derived from the trace of the 
// transaction, which adds all types of calls, including delegate calls, and the input data. 

// Unlike etherscan, this contains all transactions and does not discriminate between normal, internal, 
// and erc20 transactions 

module.exports = {

  blockSync: async () => {
    const q = 'select value_int FROM application_data WHERE field = $1 LIMIT 1'
    const result = await r.query(q, ['block_sync'])
    return result.rows[0].value_int
  },
  
  // get parent id for a given transaction
  transactionInfo: async (hash) => {
    const q = 'select id, block, timestamp FROM transactions WHERE hash = $1 LIMIT 1'
    const result = await r.query(q, [hash])
    return result.rows[0]
  },

  // use parent id to extract related topics for the transaction
  topicsForParent: async (parent) => {
    const q = 'SELECT id, parent, translate(account) FROM topic WHERE parent = $1'
    const result = await r.query(q, [parent])
    return result.rows
  },

  // Joins topics and transactions tables on transactions.id = topic.parent and
  // returns a set of transactions related to an account
  accountInfo: async (account, fromBlock = 0, limit = null, offset = 0) => {
    const q = 'select * from account_info($1, $2, $3, $4)'
    const result = await r.query(q, [account, fromBlock, limit, offset])
    return result.rows
  },

  // get the accounts related to a transaction hash
  topics: async (hash) => {
    const q = 'SELECT id, parent, translate(account) as account FROM topic WHERE parent = (SELECT id FROM transactions WHERE hash = $1)'
    const result = await r.query(q, [hash])
    return result.rows
  },


}