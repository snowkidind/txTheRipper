# Indexing Popular contracts

the process of identifying popular contracts is at hand. 

First generate some sample data with popularContracts.js

Then use Popular Lookups to scrape your node, abis and ultimately pages on Etherscan to know titles for specific addresses


- Popular contracts

  The intention of this script is to poll sections of the blockchain in order to discover 
  perpetually busy addresses. It takes 40 samplings of 240 consecutive blocks at intervals
  of 425000 blocks. The resultant set of addresses is then ranked and stored in a json file. 

- Popular Lookups

  the purpose of this script is to identify Titles on accounts for 
  a list of "popular" accounts. (see topAccts.json)
  
  Iterating this file, it tests to see if it is a contract and attempts
  to get a symbol. Upon failure of that it attempts to pull a contracts abi off of etherscan
  to get contract info. Upon EOA or Any failure it then scrapes the title out of the etherscan page.

  There are several things in place to remove redundant requests to etherscan but also since 
  this scrapes info from etherscan for which there is no endpoint it is better to do it slow

  Redundant runs of the script begin where it left off but the full scrapes and abi's are 
  saved for future use.

```
    About Sources:
      EA Ehterscan Abi
      ES Etherscan Scrape
      EC Etherscan Cached Abi
      CA Cached Abi (no source)
      CS Cached Scrape
      D Unknown (Default)
      N Node
```