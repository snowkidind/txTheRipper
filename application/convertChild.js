const env = require('node-env-file')
env(__dirname + '/../.env')
const fs = require('fs')
const dbContractCache = require('../db/contract_cache.js')
const redis = require('../db/redis.js')

let filePath
try {
  if (typeof process.argv[2] !== 'undefined') {
    filePath = process.argv[2]
  }
  const exists = fs.existsSync(filePath)
  if (!exists) {
    console.log('ERROR: spawn file does not exist', 1)
    process.exit(1)
  }
  if (!filePath) {
    console.log('ERROR: path was not set. ' + process.argv[2], 1)
    process.exit(1)
  }
} catch (error) {
  console.log(error)
}

let _jobId = filePath.split('_')
let jobId = _jobId[_jobId.length - 1].replace('.json', '')

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
          console.log('WARNING: Attempting to re-insert dbContractCache to redis, child ' + jobId)
          addressCache = await dbContractCache.getCache(cacheLimit)
          // Redis may be ded if we got here. 
          await redis.set(key, JSON.stringify(addressCache), 12 * 60 * 60) // 12 hours
          console.log('Reboot successful ' + jobId)
        }
      } else {
        addressCache = JSON.parse(cc)
      }
      const _json = await fs.readFileSync(filePath)
      const json = JSON.parse(_json)
      let matches = 0
      for (let i = 0; i < addressCache.length; i++) {
        for (let j = 0; j < json.length; j++) {
          for (let k = 0; k < json[j].topics.length; k++) {
            if (addressCache[i].account === json[j].topics[k]) {
              matches += 1
              // console.log('Match: ' + addressCache[i].account + ' ' + json[j].topics[k] + ' -> ' + addressCache[i].byteId)
              json[j].topics[k] = addressCache[i].byteId
            }
          }
        }
        // if (i % 2500 === 0) console.log('child: ' + jobId + ' accountCache: ' + percent(addressCache.length, i) + '% ', 1)
      }
      fs.writeFileSync(filePath, JSON.stringify(json))
      console.log('child:accountCache ' + jobId + ' completed successfully.', 1)
      process.exit(0)
    } catch (error) {
      console.log(error, 'Child Error. ' + jobId)
    }
  })()

const percent = (size, i) => {
  return Math.floor(i / size * 100)
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }