SET bytea_output = 'escape';

-- for queries including where block = 'blockheight' to limit db reads from prev partitions
BEGIN;
CREATE INDEX transactions_block_idx ON transactions("block");
COMMIT;

-- to call transactions by account
BEGIN;
CREATE INDEX topic_account_idx ON topic("account");
COMMIT;
BEGIN;

-- once account transactions are located in the topic table can now call the transactions above
BEGIN;
CREATE INDEX transactions_id_idx ON transactions("id");
COMMIT;


BEGIN;
CREATE INDEX transactions_hash_idx ON transactions("hash");
COMMIT;

-- OPTIONAL -- A transaction can have several topics 
-- select * from topics where parent = id
-- Recommendation:  retrieve via provider.getTransactionReceipt()
BEGIN;
CREATE INDEX topic_parent_idx ON topic("parent");
COMMIT;

/*
  Examples 

   *** NOTE In order to save cpu cycles, the database doesnt enforce lower case but also 
      expects that all new data as well as all queries are already lower cased.

  1. Get all transaction info related to an address

    SELECT tr.id, tr.block, tr.timestamp, tr.hash, t.account 
    FROM transactions tr 
    INNER JOIN topic t 
    ON tr.id = t.parent 
    AND t.account = LOWER('0x4443c72287F8089b73F2387F0716ae6AB6563c46')::BYTEA 
    AND tr.block > 14402819       -- dont search anything before here
    ORDER BY BLOCK DESC;

    indexes used: transactions.account, transactions.id, transactions.block

  2. Same Same But Different

    This query REQUIRES the topic.parent index:
    
    SELECT * FROM transactions 
    WHERE id IN (
       SELECT parent FROM topic 
       WHERE account = '0xab5801a7d398351b8be11c439e05c5b3259aec9b'
       ORDER BY id DESC limit 10
    );

    indexes used: topic.account, topic.parent, transactions.id

  3. Retrieve transaction id by hash 
    NOTE it is recommended to use the node to generate transaction meta once you have the hash

    SELECT * FROM transactions WHERE hash = '0x167402709821f1c262890717636ad671c464a1e6edbe0418c801228737322793'

    indexes used: transactions.hash
  

*/

