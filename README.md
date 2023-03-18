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

# The Process of indexing

The first step in the process is to extract the transactions from the archive node. Here, Blocks are sequentially read and traced. The trace data is then used to collect any possible addresses related to the transaction, this includes all types of calls, including delegate calls, as well as extracting input data from the transaction and harvesting accounts from it.

Each iteration of this gets its own ID and all files related are isolated. Unless the entire import process of this range completes, the indexer will pick up from the same spot. This gives a level of idempotence for the application. As long as the application isnt running, it is safe to remove files from /derived/tmp

To stop the script a simple Ctl-C is detected and is unwinds gracefully. It may take a little bit depending on how much information is currently being processed.

In order to save a lot of disk space and read writes, popular accounts are collected and then stored in a table and then assigned a numeric replacement for their account. The numeric account ID is then stored in the DB. This causes a dependency on lookup tables but it extends the life of SSD's and NVMe's (see Account Indexed Cache section below for details)

Once the JSON files have been processed, then the script generates a sql file for postgres to run (on a separate thread) This utilizes a separate process to run the db query.

Finally, after a successful PG query, the app data is updated with the latest block information and the whole process is restarted from the top.

# Featured Queries:

1. Get all transaction info related to an address in a formatted table

```
    select * from accountInfo('0xb11b8714f35b372f73cb27c8f210b1ddcc29a084', 0, NULL, 0);
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

# Identifying top accounts to Index

```
node extras/popularContracts.js
```

the intention of this script is to poll sections of the blockchain in order to discover 
  perpetually busy addresses. It takes 40 samplings of 240 consecutive blocks at intervals
  of 425000 blocks. The resultant set of addresses is then ranked and stored in a json file. 

  Upon running it took 13.9 minutes to execute at a block height of 16700000

# Etherscan Scraper for account names

```
node extras/popularLookup.js
```
  Above we generated a list of popular addresses, but it's anonymous and there is value in identifying them so this scraper was included to do as much. It only displays the data. All the results are cached in order to avoid redundant calls / burden on Etherscan.

  Iterating the file made previously, it tests to see if it is a contract and attempts
  to get a symbol. Upon failure of that it attempts to pull a contracts abi off of etherscan
  to get contract info. Upon EOA or Any failure, it filally scrapes the title tag from the etherscan page.

  There are several things in place to remove redundant requests to etherscan but also since 
  this scrapes info from etherscan for which there is no endpoint it is better to do it slow

  Redundant runs of the script begin where it left off and the full scrapes and abi's are 
  saved for future use.

  About Sources as displayed during execution:
   - EA Etherscan Abi
   - ES Etherscan Scrape
   - EC Etherscan Cached Abi
   - CA Cached Abi (no source)
   - CS Cached Scrape
   - D Unknown (Default)
   - N Node

# Hardware requirements

 - Ubuntu
 - 64G Ram
 - Intel i7 class or greater processor
 - SSD with at least 4 Gigs for archival node
 - Second SSD or NVMe for index

# Software Requirements

 - Redis
 - Postgres Database (use tablespaces to assign to a separate drive)
 - NodeJs > 14.9
 - Ethers ~v5 (Note v6 is not compatible)

***

# Configuration

[system]

This is the path to your node implementation.  Detect with `which node`

```
EXEC_NODE=/your/path/to/node
```

The path to the directory that ripper.js lives in

```
BASEPATH=/home/user/txRipper/
```

The sync operation requires a direct, preferably same machine connection with a node
the blockchain ID your node is - Mainnet = 1 https://chainlist.org/
```
RPC_NODE=http://192.168.1.104:8545
CHAIN_ID=1
```

[Utilities]

To use the "popular wallets" utilities add your etherscan api key here.
In order to not get banned they implement their own rate limiter which 
keeps the app running smoother than leaning on the etherscan 5 second 
rate limit. Increase with caution
```
ETHERSCAN_API_KEY=YOURETHERSCANAPIKEYHERE
ETHERSCAN_REQ_RATE=2
```

[Database Settings]

```
DB_USER=dbUser
DB_HOST=localhost
DB_NAME=dbName
DB_PASS=dbUserPassword
REDIS_URL=redis://127.0.0.1:6379
```

[Logging]

Log levels: 
1. standard operation
2. ddebug 
3. verbose 
4. objects

logs to derived/application/log true or false or comment out
```
LOG_LEVEL=4
LOG_TO_FILE=false 
```

[Application]

This is the number of confirmations that ripper should stay behind a node. 
In order to prevent reorgs from corrupting the data, keep this back about 20 blocks

```
CONFIRMATIONS=20
```

[Memory Usage]
Number of blocks to sync before writing to JSON file. this is not a full db commit but 
can be adjusted to fit the resources available/used on the given machine
Nvme? Higher disk usage ok = More commits = Less Memory used

the process here is 
extractor - disk intensive 
cacheing accounts - cpu intensive, single threaded
writing postgres - disk intensive

```
COMMIT_EVERYN_BLOCKS=500
```

number of bytes a JSON Batch file may have 
   This value also is about the same size the sql file generated will be
Recommended starting point here is 300 MB: 300000000

In total the temp files will comprise about double this space at one point in time.

```
JSON_TX_FILE_MAX=50000000
```

Bangkok time zone (this is currently unimplemented.)

```
UTC_TZ_OFFSET=7
```

# TODO's

Load in sql functions on init

