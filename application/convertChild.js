const env = require('node-env-file')
env(__dirname + '/../.env')
const fs = require('fs')

const { log, logError } = require('../utils/log')
const redis = require('../db/redis.js')

let filePath
try {
  if (typeof process.argv[2] !== 'undefined') {
    filePath = process.argv[2]
  }
  const exists = fs.existsSync(filePath)
  if (!exists) {
    log('ERROR: spawn file does not exist', 1)
    process.exit(1)
  }
  if (!filePath) {
    log('ERROR: path was not set. ' + process.argv[2], 1)
    process.exit(1)
  }
} catch (error) {
  logError(error)
}

let _jobId = filePath.split('_')
let jobId = _jobId[_jobId.length -1].replace('.json', '')

; (async () => {
  // log('child:accountCache jobId: ' + jobId + ' starting with pId: ' + process.pid, 1)
  const key = 'ripper:contractCache'
  let addressCache
  const cc = await redis.get(key)
  if (!cc) {
    addressCache = await dbContractCache.getCache(cacheLimit)
    redis.set(key, JSON.stringify(addressCache), 12 * 60 * 60) // 12 hours
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
          // log('Match: ' + addressCache[i].account + ' ' + json[j].topics[k] + ' -> ' + addressCache[i].byteId)
          json[j].topics[k] = addressCache[i].byteId
        }
      }
    }
    // if (i % 2500 === 0) log('child: ' + jobId + ' accountCache: ' + percent(addressCache.length, i) + '% ', 1)
  }
  fs.writeFileSync(filePath, JSON.stringify(json))
  log('child:accountCache ' + jobId + ' completed successfully.', 1)
  process.exit(0)
})()

const percent = (size, i) => {
  return Math.floor(i / size * 100)
}