# TxRipper - the Ethereum Transaction Indexer

TxRipper will index the accounts and transactions in the database to allow for looking up some basic things.

The way the indexer is structured, it also retrieves accounts from delegate calls and input data, so when you compare the results to the "pretty" results of etherscan, you can see all of the accounts that are involved with a transaction.

It does not calculate state differences, and expects you to have an accessible archive node at the ready to further parse database results.

here is an example where an account of interested is provided and all of the transactions related to that account are returned:

```

accountInfo(Account, FromBlock, Limit, Offset)

select * from accountInfo('0xb11b8714f35b372f73cb27c8f210b1ddcc29a084', 0, NULL, 0);

Results: 

    id    |  block  | timestamp  |                                hash                                |                  account
----------+---------+------------+--------------------------------------------------------------------+--------------------------------------------
 19769149 | 3452054 | 1490969199 | 0xf5fdc8c9839f299b85520112e64c484737da6df824bd97823cc44b71ffc42b11 | 0xb11b8714f35b372f73cb27c8f210b1ddcc29a084
 19730022 | 3449641 | 1490934438 | 0xed98d64c711660b68195b4604e881cc0e3cd4fac3582186391533fb69bef32aa | 0xb11b8714f35b372f73cb27c8f210b1ddcc29a084
(2 rows)

syncPoint was 3452553 for this request

```


***
# The Process of indexing

The first step in the process is to extract the transactions from the archive node. Here, Blocks are sequentially read and traced. The trace data is then used to collect any possible addresses related to the transaction

Each iteration of this gets its own ID and all files related are isolated. Unless the entire import process of this range completes, the indexer will pick up from the same spot. This gives some level of idempotence for the application, but when the process doesnt complete because of an issue, some inert files may be left around. As long as the application isnt running, it is safe to remove files from /derived/tmp

In order to save a lot of disk space and read writes, popular accounts are collected and then stored in a table and then assigned a numeric replacement for their account. The numeric account ID is then stored in the DB. This causes a dependency on lookup tables but it extends the life of SSD's and NVMe's

Once the JSON files have been processed, then the script generates a sql file for postgres to run (on a separate thread) This utilizes multi cores.

Finally, after a successful PG query, the app data is updated with the latest block information and the whole process is restarted from the top.


***

# Featured Queries:

1. Get all transaction info related to an address

```
    SELECT tr.id, tr.block, tr.timestamp, encode(tr.hash, 'escape') AS hash, encode(t.account, 'escape') AS account 
    FROM transactions tr 
    INNER JOIN topic t 
    ON tr.id = t.parent 
    AND t.account = LOWER('0x4443c72287F8089b73F2387F0716ae6AB6563c46')::BYTEA 
    AND tr.block > 14402819
    ORDER BY BLOCK DESC;
```


2. Retrieve transaction block and timestamp

```
    SELECT id, block, timestamp 
    FROM transactions
    WHERE hash = '0x167402709821f1c262890717636ad671c464a1e6edbe0418c801228737322793'
```

3. Retrieve accounts associated with transaction 

```
    SELECT id, parent, encode(account, 'escape') as account FROM topic 
    WHERE parent = 
      ( SELECT id 
        FROM transactions 
        WHERE hash = '0x167402709821f1c262890717636ad671c464a1e6edbe0418c801228737322793');
```

# Auditing a block of the data

  `node extras/audit.js 3452553`

  The auditor picks the head block if no specific block is specified at the command line
  this test picks up the database information and then compares it with fresh data pulled from the node.

# Account Indexed Cache

txRipper uses an index cache to record accounts that appear millions of times in the database, having a notable impact on account size. Think USDT, Uniswap Pools, Binance EOA's. These busy Ids are stored in binary (thats BYTEA in PG). 

In order to do this a pre scan occurs that takes a one hour long sampling of blocks every 450k blocks and accumulates these addresses by rank. Addresses that occur frequently are then converted to an integer index and the original stored in a separate table, thereby reducing the db size (and read/writes) significantly.

In order to make querying the database easier, a translate() function has been included, which serves as a easy way to implement encode(x, 'escape') when the results are mixed in with other regular data:

```
Function translate(account), use where value is stored as "bytea"

select translate(account) as account from topic where id = 31438885;

Results:
                  account
--------------------------------------------
 0xd34da389374caad1a048fbdc4569aae33fd5a375
```

# Hardware requirements

 - Ubuntu
 - 64G Ram
 - Intel i7 class or greater processor
 - SSD with at least 4 Gigs for archival node
 - Second SSD or NVMe for index

***

# Configuration

.env stuff here

***

# Notes

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


