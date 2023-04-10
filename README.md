# txTheRipper - the Ethereum Transaction Indexer

txTheRipper runs alongside your Erigon archive node by connecting to its rpc servers websocket to listen for new blocks. When a block is found, it then runs an import program which scans and adds some data for any new transactions. In sync mode, the primary feature of this is looking up transaction history by account. In subscription mode, notifications are passed to other applications based on criteria during the parsing of new blocks. There are some hardware considerations as well as additional storage requirements. 

# Modes of operation 

There are two modes of operation for txTheRipper: `sync` and `subscription`.

- sync parses all blocks and adds the transaction information to the database. It also provides the subscription interface.
- subscription does not save anything to the database, besides application settings. This provides only the subscription interface without the overhead of synchronizing the entire blockchain.

Both modes operate using a deterministic, sequential method. Each must be established on a fresh database, and cannot be changed without resetting the database to zero. 

# sync mode

The sync method will synchronize data for all blocks, which takes days to get the full database rolling. (Alternatively, there is a kickstarting method) Since a historical database is being created, sync must begin from the first blocks containing transactions on the chain, and continue tracing all transactions until the highest recent block.  All services from subscription mode are available when the program is set to sync mode, except that during the initial sync, subscription mode will alert for information on the current block sync height, for the entirety of the blockchain history.

# subscription mode

Subscribe to get notifications from incoming transactions on an service by service basis. The application provides delivery methods via unix socket and redis pub/sub. The data that is delivered contains

- the transaction hash
- topics (accounts) this includes all types of calls and accounts harvested from input data
- the full trace of the transaction

In subscription mode, the database is not used to store any information. However, the latest block height and other application data is stored to deterministically find the sync point, over application restarts.

The subscription method will synchronize to the latest block, minus the confirmations setting, on its first run, and on subsequent runs, will synchronize to the block height from the previous run. Once the subscription method starts, no subsequent blocks will be missed, even through application downtime or restarts. The services from subscription mode (below) are also available during the sync mode. All notifications from subscriptions will coorelate to the height of the current database sync.

See the page that is [All about subscriptions](application/subscriptions/SUBSCRIPTIONS.md)

# Kickstarting the sync

Retrieving block data and indexing the cache for millions of blocks can be a time consuming process. To save time, you can Kickstart the database by importing the chain data and index_cache for the historical data. (data availibility may vary as a function of funding.) 

Alternate methods for quickstarting txTheRipper:

- export your own txTheRipper data to sql files and import them
- recover via pg_dump (if you have the resource)

To enable kickstarting, on a clean database, (use the nuke database function in the cli) argue:

> The kickstart download isnt currently available but the author is willing to make arrangements to pass this on to people interested in the project.

```
node ripper.js k /path/to/kickstartdir
```

This will begin the process of installing sql files found in the kickstart directory. Once the kickstart process is complete, it is safe to remove files in the kickstart directory or just save them as a backup.

Some things to consider: During the application data export process, "generations" based on block height and the highest found export file are exported. This allows the exports to grow as the database grows without requiring entire redos. 

> It is important to note that the index_cache.sql file MUST be the exact file used to export the data, that is the exported chain data works in tandem with the index cache, and there would be data consistency errors if the file was modified without a new complete backup.

# Sync mode: The structure of the database

The data is imported to two postgresql tables: "transactions", and "topic"  For each transaction received, any accounts scraped from the transaction will be added as a row in the topic table. 

Accounts are collected from the "from", "to", "input data" fields, as well as all types of calls, including delegate calls and inserted into "topic". This links to the "parent" id in the "transaactions" table.

```
                        Partitioned table "public.transactions"
  Column   |  Type   | Collation | Nullable |                 Default
-----------+---------+-----------+----------+------------------------------------------
 id        | bigint  |           | not null | nextval('transactions_id_seq'::regclass)
 block     | integer |           | not null |
 timestamp | integer |           | not null |
 hash      | bytea   |           | not null |
 Partition key: RANGE (block)
 
                        Partitioned table "public.topic"
 Column  |  Type   | Collation | Nullable |              Default
---------+---------+-----------+----------+-----------------------------------
 id      | bigint  |           | not null | nextval('topic_id_seq'::regclass)
 parent  | integer |           | not null | 
 account | bytea   |           | not null |
Partition key: RANGE (id)

```

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

# Sync mode: The process of indexing

Each iteration of this gets its own ID and all files related are isolated. Unless the entire import process of this range completes, the indexer will pick up from the same spot. This gives a level of idempotence for the application. As long as the application isnt running, it is safe to remove files from /derived/tmp

The application will connect to your node's websocket and listen for new blocks. When a new block is found, the following cycle will be completed:

1. Extraction. The first step in the process is to extract the transactions from the archive node. Here, Blocks are sequentially read and traced. The trace data is then used to collect any possible addresses related to the transaction, this includes all types of calls, including delegate calls, as well as extracting input data from the transaction and harvesting accounts from it.

2. Indexed cacheing. In order to save a lot of disk space and read writes, popular accounts are collected and then stored in a table and then assigned a numeric replacement for their account. The numeric account ID is then stored in the DB. This causes a dependency on lookup tables but it extends the life of SSD's and NVMe's (see Account Indexed Cache section below for details)

3. Insertion. Once the JSON files have been processed, then the script generates a sql file for postgres to run (on a separate thread) This utilizes a separate process to run the db query.

4. Finalizing. After a successful PG query, the app data is updated with the latest block information, temporary files are cleared, and the whole process is restarted from the top.


# Sync mode: Account indexed cache

txTheRipper uses an index cache to record accounts that appear millions of times in the database, having a notable impact on account size. Think USDT, Uniswap Pools, Binance EOA's. These busy Ids are stored in binary (thats BYTEA in PG). 

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

 - Was built on Ubuntu 22
 - 64G Ram
 - Intel i7 class or greater processor
 - SSD with at least 4 Gigs (for archival node)
 - 1T Second SSD or NVMe (for the index)

## Software Requirements

 - Functional erigon archival node (might work on others who use the trace_block rpc request)
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

The mode is based on your application. For a "Full Archive" sync of the database, that is,
to process each block and save transaction and topics data to a database, select "sync". 
to process each block and only provide subscription services select "subscription"

```
OPERATION_MODE=sync
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

Instead of delegating child jobs with files, use redis to pass data

```
USE_REDIS_DATA=true
```

To not use an index cache turn this on. Just leave commented out unless you have other purposes

```
INDEX_CACHE_DISABLE=true
```
To not install regular DB indexes, Basically to render the entire databse unusable, uncomment this

```
DONT_INDEX=true
```

[subscriptions]
(Work in progress) The subscriptions module allows events to be either broadcasted via redis or unix socket. During the indexing of a block, which the trace is being read it allows the program to efficiently deliver notifications about such events. In the future a rest server will be built on the unix socket to allow for external use of the api. 

```
SUB_SUSPEND_ALL=false
```

Subscription service delivery methods:
Enable subscriptions based on the unix socket path below

```
SUB_USE_UNIX_SOCKET=true
SUB_UNIX_SOCKET=/issan/keny/txTheRipper/derived/application/ripper.sock
```

Enable subscriptions where notifications are delivered to the redis config above.
```
SUB_USE_REDIS=true
```

for all delivery methods above, add the services supported here

the account service is a simple filter which provides data when a particular account 
is found in topics of a transaction

```
SUB_TYPE_ACCOUNT=true
```