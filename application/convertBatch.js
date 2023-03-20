const fs = require('fs')
const { dbContractCache, dbAppData, dbRedis } = require('../db')
const { jobTimer, system } = require('../utils')
const { start, stop } = jobTimer
const { log } = require('../utils/log')

const contractCacheMax = 10000
const baseDir = process.env.BASEPATH + 'derived/tmp/'

module.exports = {
  convertBatchAccounts: async (jobId) => {
    const pause = await dbAppData.pauseStatus()
    if (pause) {
      log('NOTICE: >>>>>>> Pause flag detected <<<<<< Will Exit at end of this cycle.', 1)
    }
    const batchJsonFile = baseDir + jobId + '.json'
    log('NOTICE: Converting batch to addressCache', 1)
    start('Convert Batch')
    const beforestats = await fs.statSync(batchJsonFile)
    let cacheLimit = await dbContractCache.cacheSize()
    if (cacheLimit > contractCacheMax) {
      cacheLimit = contractCacheMax
    }

    const key = 'ripper:contractCache'
    let addressCache
    const cc = await dbRedis.get(key)
    if (!cc) {
      addressCache = await dbContractCache.getCache(cacheLimit)
      dbRedis.set(key, JSON.stringify(addressCache), 12 * 60 * 60) // 12 hours
    } else {
      addressCache = JSON.parse(cc)
    }
    const _json = await fs.readFileSync(batchJsonFile)
    let json = JSON.parse(_json)
    if (process.env.USE_MULTI_THREADS === 'true') {

      const jsonL = json.length
      // Split the large JSON object up into separate files and spawn chile processes to handle the conversion
      const mt = Number(process.env.MULTI_THREADS) || 4
      const threads = mt - 1
      const divisor = Math.floor(json.length / threads) + 1
      const files = []
      for (let i = 0; i < json.length; i += divisor) {
        const data = json.slice(i, i + divisor)
        const filePath = baseDir + jobId + '_' + i + '.json'
        // log(filePath + ' ' + data.length + ' entries', 2)
        fs.writeFileSync(filePath, stringify(data))
        files.push(filePath)
      }
      delete json
      let promises = []
      for (let i = 0; i < files.length; i++) {
        log('deploying child: ' + jobId + '_' + i + '.json', 1)
        const cmd = process.env.BASEPATH + 'application/convertChild.js ' + files[i]
        promises.push(system.execCmd(process.env.EXEC_NODE + ' ' + cmd))
      }
      await Promise.all(promises)
      let jsonOut = []
      for (let i = 0; i < files.length; i++) {
        const _file = fs.readFileSync(files[i])
        const data = JSON.parse(_file)
        jsonOut = [...jsonOut, ...data] // Combine split files into output
        fs.rmSync(files[i])
      }
      fs.writeFileSync(batchJsonFile, stringify(jsonOut, null, 4))
      if (jsonOut.length !== jsonL) {
        throw 'ERROR: files were munged during translation.'
      }
    } else {
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
        if (i % 500 === 0) log('Converting batch to addressCache: ' + percent(addressCache.length, i) + '%', 1)
      }
      fs.writeFileSync(batchJsonFile, stringify(json, null, 4))
    }

    const afterestats = await fs.statSync(batchJsonFile)
    const diff = beforestats.size - afterestats.size
    stop('Convert Batch', true)
    log('NOTICE: Address Conversion saved ' + diff + ' bytes on this batch.', 2)
  }
}

const percent = (size, i) => {
  return Math.floor(i / size * 100)
}

const stringify = (obj) => {
  if (obj.length === 0) {
    return JSON.stringify(obj) 
  }
  let acc = '[\n'
  obj.forEach((obj) => { acc += '  ' + JSON.stringify(obj) + ',\n' })
  acc = acc.slice(0, acc.length - 2)
  acc += '\n]'
  return acc
}