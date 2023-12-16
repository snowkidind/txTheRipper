const env = require('node-env-file')
env(__dirname + '/../.env')
const fs = require('fs')
const dbContractCache = require('../db/contract_cache.js')
const redis = require('../db/redis.js')
const { log, logError } = require('../utils/log')

/* 

  RE: Redis configuration. So far no steps have been taken to configure redis, but here is some information.

  See Also: https://redis.io/docs/reference/clients/  
  
  Since these are all deployed simultaneously, there is a chance when using memory that redis gets overwhelmed
  items of concern:

   "Every client is also subject to a query buffer limit. This is a non-configurable 
   hard limit that will close the connection when the client query buffer (that is the 
    buffer we use to accumulate commands from the client) reaches 1 GB"

    *maxmemory-clients* can be set permanently in the configuration file (redis.conf) 
    or via the CONFIG SET command. This setting can either be 0 (meaning no limit), 
    a size in bytes (possibly with mb/gb suffix), or a percentage of maxmemory by 
    using the % suffix (e.g. setting it to 10% would mean 10% of the maxmemory configuration).

    The default setting is 0, meaning client eviction is turned off by default. However, 
    for any large production deployment, it is highly recommended to configure some non-zero 
    maxmemory-clients value. A value 5%, for example, can be a good place to start.
*/
const useRedisData = process.env.USE_REDIS_DATA === 'true' ? true : false

const contractCacheMax = 10000

let filePath
try {
  if (typeof process.argv[2] !== 'undefined') {
    filePath = process.argv[2]
  }
  if (!useRedisData) {
    const exists = fs.existsSync(filePath)
    if (!exists) {
      console.log('ERROR: spawn file does not exist', 1)
      process.exit(1)
    }
  }
  if (!filePath) {
    console.log('ERROR: path or key was not set. ' + process.argv[2], 1)
    process.exit(1)
  }
} catch (error) {
  console.log(error)
}


let jobId
if (useRedisData) {
  jobId = filePath
} else {
  let _jobId = filePath.split('_')
  jobId = _jobId[_jobId.length - 1].replace('.json', '')
}


  ; (async () => {
    try {
      // console.log('child:accountCache jobId: ' + jobId + ' starting with pId: ' + process.pid, 1)
      const key = 'ripper:contractCache'
      let addressCache
      let cc = await redis.get(key) // possibly max connections reached
      if (!cc) {
        await sleep(2000)
        cc = await redis.get(key)
        if (!cc) {
          await sleep(2000)
          console.log('WARNING: Attempting to re-insert dbContractCache to redis, child ' + jobId)
          let cacheLimit = await dbContractCache.cacheSize()
          if (cacheLimit > contractCacheMax) {
            cacheLimit = contractCacheMax
          }

          addressCache = await dbContractCache.getCache(cacheLimit)
          // Redis may be ded if we got here. 
          await redis.set(key, JSON.stringify(addressCache))
        }
      } else {
        addressCache = JSON.parse(cc)
      }

      const keyRedis = jobId
      let json, _json
      if (useRedisData) {
        _json = await redis.get(keyRedis)
      } else {
        _json = await fs.readFileSync(filePath)
      }
      await redis.del(keyRedis)
      json = JSON.parse(_json)
      if (json.length === 0) {
        console.log('This JSON file is empty.')
      }
      delete _json
      let matches = 0

      // iterate all cache
      for (let i = 0; i < addressCache.length; i++) {

        // iterate all json tx
        for (let j = 0; j < json.length; j++) {

          // iterate topics per tx
          for (let k = 0; k < json[j].topics.length; k++) {

            // if cached acct === topic
            if (addressCache[i].account === json[j].topics[k]) {
              matches += 1
              // console.log('Match: ' + addressCache[i].account + ' ' + json[j].topics[k] + ' -> ' + addressCache[i].byteId)
              
              // assign byteId of cached acct to topic
              json[j].topics[k] = addressCache[i].byteId
            }
          }
        }
        // if (i % 2500 === 0) console.log('child: ' + jobId + ' accountCache: ' + percent(addressCache.length, i) + '% ', 1)
      }

      if (useRedisData) {
        await redis.set(keyRedis + '_out', JSON.stringify(json))
      } else {
        fs.writeFileSync(filePath, JSON.stringify(json))
      }
      // console.log(jobId + ' completed successfully.', 1)
      process.exit(0)
    } catch (error) {
      console.log(error, 'Child Error. ' + jobId)
      logError(error)
    }
  })()

const percent = (size, i) => {
  return Math.floor(i / size * 100)
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }