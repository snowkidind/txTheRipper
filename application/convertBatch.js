const fs = require('fs')
const { dbContractCache } = require('../db')
const { jobTimer } = require('../utils')
const { start, stop } = jobTimer
const { log } = require('../utils/log')

const contractCacheMax = 10000
const baseDir = process.env.BASEPATH + 'derived/tmp/'

module.exports = {
  convertBatchAccounts: async (jobId) => {
    const batchJsonFile = baseDir + jobId + '.json'
    log('NOTICE: Converting batch to addressCache', 2)
    start('Convert Batch')
    const beforestats = await fs.statSync(batchJsonFile)
    let cacheLimit = await dbContractCache.cacheSize()
    if (cacheLimit > contractCacheMax) {
      cacheLimit = contractCacheMax
    }
    const addressCache = await dbContractCache.getCache(cacheLimit)
    const _json = await fs.readFileSync(batchJsonFile)
    let json = JSON.parse(_json)
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
    }
    fs.writeFileSync(batchJsonFile, stringify(json, null, 4))
    const afterestats = await fs.statSync(batchJsonFile)
    const diff = beforestats.size - afterestats.size
    stop('Convert Batch', true)
    log('NOTICE: Address Conversion saved ' + diff + ' bytes on this batch.', 2)
  }
}

const stringify = (obj) => {
  let acc = '[\n'
  obj.forEach((obj) => { acc += '  ' + JSON.stringify(obj) + ',\n' })
  acc = acc.slice(0, acc.length - 2)
  acc += '\n]'
  return acc
}