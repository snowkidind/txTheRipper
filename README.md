# TxRipper - Ethereum Transaction Indexer

TxRipper will index the accounts and transactions in the database to allow for looking up some basic things.

  1. Get all transaction info related to an address

`
    SELECT tr.id, tr.block, tr.timestamp, tr.hash, t.account 
    FROM transactions tr 
    INNER JOIN topic t 
    ON tr.id = t.parent 
    AND t.account = LOWER('0x4443c72287F8089b73F2387F0716ae6AB6563c46')::BYTEA 
    AND tr.block > 14402819       -- dont search anything before here
    ORDER BY BLOCK DESC;
`

2. Retrieve accounts associated with transaction 

`
    SELECT id, block, timestamp 
    FROM transactions 
    WHERE hash = '0x167402709821f1c262890717636ad671c464a1e6edbe0418c801228737322793'
    
    SELECT * FROM topic 
    WHERE parent = 
      ( SELECT id 
        FROM transactions 
        WHERE hash = '0x167402709821f1c262890717636ad671c464a1e6edbe0418c801228737322793');
`


import popular addresses into account_index
sync process
  check paused status
  check latest block height
  get block sync height from db
  pull data from db
  on interval commit to json file per usual
  when file is x big or highest block reached, stop sync process.
  open json file and replace addresses with indexed addresses, save
  get row indexes from db 
  ensure there is enough partition space for data, create new as needed
  convert JSON file to sql, includes
    update block sync height in db
    update high row insert in db for all tables
  import sql to database
  remove json and sql file
  begin again


