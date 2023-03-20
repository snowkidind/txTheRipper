# TxRipper - the Ethereum Transaction Indexer

txRipper runs alongside your archive node by connecting to its rpc servers websocket to listen for new blocks. When a block is found, it then runs an import program which scans and adds some data for any new transactions. The primary feature of this is looking up transaction history by account. There are some hardware considerations as well as additional storage requirements. 

# Database

The data is imported to two postgresql tables: "transactions" contains the hash, the blockHeight and timestamp. For each transaction received, any addresses associated with from, to, "input data" as well as all types of calls, including delegate calls are added as rows in the "topic" table, along with a parent id from the transactions table.

Sql functions as well as indexes are installed during operation to allow easy access to the data. 

1. Get all transaction info related to an address in a formatted table

```
Function account_info(Account, FromBlock, Limit, Offset)
Returns: id, block, timestamp, hash(text), account(text)

    SELECT * FROM account_info('0xb11b8714f35b372f73cb27c8f210b1ddcc29a084', 0, NULL, 0);

Results: 

    id    |  block  | timestamp  |                                hash                                |                  account
----------+---------+------------+--------------------------------------------------------------------+--------------------------------------------
 19769149 | 3452054 | 1490969199 | 0xf5fdc8c9839f299b85520112e64c484737da6df824bd97823cc44b71ffc42b11 | 0xb11b8714f35b372f73cb27c8f210b1ddcc29a084
 19730022 | 3449641 | 1490934438 | 0xed98d64c711660b68195b4604e881cc0e3cd4fac3582186391533fb69bef32aa | 0xb11b8714f35b372f73cb27c8f210b1ddcc29a084
(2 rows)

syncPoint was 3452553 for this request

```

2. Retrieve transaction block and timestamp. The id field can be used to search for related accounts in the topic table.

```
    SELECT id, block, timestamp 
    FROM transactions
    WHERE hash = '0x167402709821f1c262890717636ad671c464a1e6edbe0418c801228737322793'
```

3. Translate BYTEA to legible ethereum address

```
Function translate(ByteId)
Returns varchar

select translate(account) as account from topic where id = 31438885;

Results:
                  account
--------------------------------------------
 0xd34da389374caad1a048fbdc4569aae33fd5a375
```

4. Retrieve accounts associated with transaction. Note because of the indexed cache feature, you must translate() the account column. 

```


    SELECT id, parent, translate(account) as account FROM topic 
    WHERE parent = 
      ( SELECT id 
        FROM transactions 
        WHERE hash = '0x167402709821f1c262890717636ad671c464a1e6edbe0418c801228737322793');
```

5. For raw requests, you can display tables as normal hexidecimal hashes NOT bytes during your session like this.
```
    SET bytea_output = 'escape';
```

To stop the script a simple Ctl-C is detected and it unwinds gracefully. It may take a little bit depending on how much information is currently being processed.

# The process of indexing

Each iteration of this gets its own ID and all files related are isolated. Unless the entire import process of this range completes, the indexer will pick up from the same spot. This gives a level of idempotence for the application. As long as the application isnt running, it is safe to remove files from /derived/tmp

The application will connect to your node's websocket and listen for new blocks. When a new block is found, the following cycle will be completed:

1. Extraction. The first step in the process is to extract the transactions from the archive node. Here, Blocks are sequentially read and traced. The trace data is then used to collect any possible addresses related to the transaction, this includes all types of calls, including delegate calls, as well as extracting input data from the transaction and harvesting accounts from it.

2. Indexed cacheing. In order to save a lot of disk space and read writes, popular accounts are collected and then stored in a table and then assigned a numeric replacement for their account. The numeric account ID is then stored in the DB. This causes a dependency on lookup tables but it extends the life of SSD's and NVMe's (see Account Indexed Cache section below for details)

3. Insertion. Once the JSON files have been processed, then the script generates a sql file for postgres to run (on a separate thread) This utilizes a separate process to run the db query.

4. Finalizing. After a successful PG query, the app data is updated with the latest block information, temporary files are cleared, and the whole process is restarted from the top.


# Account indexed cache

txRipper uses an index cache to record accounts that appear millions of times in the database, having a notable impact on account size. Think USDT, Uniswap Pools, Binance EOA's. These busy Ids are stored in binary (thats BYTEA in PG). 

In order to do this a pre scan occurs that takes a one hour long sampling of blocks every 450k blocks and accumulates these addresses by rank. Addresses that occur frequently are then converted to an integer index and the original stored in a separate table, thereby reducing the db size (and read/writes) significantly.


# Auditing a block of the data

  `node extras/audit.js 3452553`

The auditor picks the head block if no specific block is argued at the command line. This test picks up the database information and then compares it with fresh data pulled from the node. Results out to console.log

# Extras

## Identifying top accounts to Index

```
node extras/popularContracts.js
```

Part of the initialization process utilizes this script. Its intention is to poll sections of the blockchain in order to discover perpetually busy addresses. It takes 40 samplings of 240 consecutive blocks at intervals of 425000 blocks. The resultant set of addresses is then ranked and stored in a json file, then imported into SQL. It can also run as a standalone.

> Upon running this section took 13.9 minutes to execute at a block height of 16700000

## Etherscan scraper for account names

```
node extras/popularLookup.js
```
  Above we generated a list of popular addresses, but it's anonymous and there is value in identifying them so this scraper was included to do as much. There are no associated database functions, it only displays the data it finds to the console. All the results are cached in order to avoid redundant calls / burden on Etherscan.

  Iterating the file made previously, it tests to see if it is a contract and attempts to get a symbol. Upon failure of that it attempts to pull a contracts abi off of etherscan to get contract info. Upon EOA or Any failure, it filally scrapes the title tag from the etherscan page.

  There are several things in place to remove redundant requests to etherscan but also since this scrapes info from etherscan for which there is no endpoint it is better to do it slow.

  Redundant runs of the script begin scraping where it left off and the full scrapes and abi's are 
  saved for future use.

  About Sources as displayed during execution:
   - EA Etherscan Abi
   - ES Etherscan Scrape
   - EC Etherscan Cached Abi
   - CA Cached Abi (no source)
   - CS Cached Scrape
   - D Unknown (Default)
   - N Node

# Installation

## Hardware requirements

 - Ubuntu
 - 64G Ram
 - Intel i7 class or greater processor
 - SSD with at least 4 Gigs for archival node
 - Second SSD or NVMe for index

## Software Requirements

 - Functional erigon archival node
 - Redis
 - Postgres Database (use tablespaces to assign to a separate drive)
 - NodeJs > 14.9
 - Ethers ~v5 (Note v6 is not compatible)

## Procedure

 - Install Redis
 - Install Postgres and create a db
 - configure .env file
 - git clone https://github.com/snowkidind/txTheRipper.git
 - npm install
 - node ripper.js

## Command line interface

If the application has crashed uncleanly, there is a command line interface which appears, thereby pausing operation. Inside, you can utilize the unpause function to allow the program to run as normal. It also contains function to destroy all the tables in the database if you want to restart your sync, and clear the log file located in derived/application/log You can disable logging to file by configuring .env (see below). You can instantiate the cli by arguing at the command line as such: `./ripper.js cli`
 
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
RPC_NODE_WS=http://192.168.1.104:8545
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

In order to connect to the database, first you much create one, and assign it some credentials. In addition to postgres, redis is also required for this installation.

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

when a websocket is closed wait this many seconds until attempting to reconnect (5 seconds)

```
WS_RECONNECT_TIMEOUT=5
```

# To not use an index cache turn this on. Just leave commented out unless you have other purposes

```
INDEX_CACHE_DISABLE=true
```
# To not install regular DB indexes, To render the entire databse unusable, uncomment this

```
DONT_INDEX=true
```
# TODO's

Test the top of the stack
