const fs = require('fs')
const { dbContractCache, dbAppData, dbRedis } = require('../db')
const { jobTimer, system } = require('../utils')
const { start, stop } = jobTimer
const { log, logError } = require('../utils/log')

const contractCacheMax = 10000
const baseDir = process.env.BASEPATH + 'derived/tmp/'
const useRam = process.env.OPTIMIZE_DISK_WRITES === 'true' ? true : false
const useRedisData = process.env.USE_REDIS_DATA === 'true' ? true : false

module.exports = {
  convertBatchAccounts: async (jobId, _data) => {
    try {
      const pause = await dbAppData.pauseStatus()
      if (pause) {
        log('NOTICE: >>>>>>> Convert batch: Pause flag detected <<<<<< Will Exit at end of this cycle.', 1)
      }
      start('Convert Batch')
      log('NOTICE: Converting batch to addressCache', 1)
      const batchJsonFile = baseDir + jobId + '.json'
      let beforestats = { size: JSON.stringify(_data) }
      if (!useRam) {
        beforestats = await fs.statSync(batchJsonFile)
      } 
      let cacheLimit = await dbContractCache.cacheSize()
      if (cacheLimit > contractCacheMax) {
        cacheLimit = contractCacheMax
      }
      const key = 'ripper:contractCache'
      let addressCache
      const cc = await dbRedis.get(key)
      if (!cc) {
        addressCache = await dbContractCache.getCache(cacheLimit)
        await dbRedis.set(key, JSON.stringify(addressCache), 12 * 60 * 60) // 12 hours
      } else {
        addressCache = JSON.parse(cc)
      }

      let json
      if (useRam) {
        json = _data
      } else {
        const _json = await fs.readFileSync(batchJsonFile)
        json = JSON.parse(_json)
      }
      // Split the large JSON object up into separate files and spawn child 
      // processes to handle the conversion
      if (process.env.USE_MULTI_THREADS === 'true') {
        const jsonL = json.length
        const mt = Number(process.env.MULTI_THREADS) || 4
        const threads = mt - 1
        const divisor = Math.floor(json.length / threads) + 1
        const files = []

        const keys = await dbRedis.keys('ripper:child*')
        for (let i = 0; i < keys.length; i++) {
          // log('redis.del: ' + keys[i], 3)
          await dbRedis.del(keys[i])
        }

        for (let i = 0; i < json.length; i += divisor) {
          const data = json.slice(i, i + divisor)
          if (useRedisData) {
            const key = 'ripper:child:' + jobId + '_' + i
            await dbRedis.set(key, JSON.stringify(data))
            files.push(key)
          } else {
            const filePath = baseDir + jobId + '_' + i + '.json'
            fs.writeFileSync(filePath, stringify(data))
            files.push(filePath)
          }
        }
        delete json
        let promises = []
        log('deploying children for job: ' + jobId, 1)
        for (let i = 0; i < files.length; i++) {
          // TODO check that the order of this returns in the proper order
          const cmd = process.env.BASEPATH + 'application/convertChild.js ' + files[i]
          promises.push(system.execCmd(process.env.EXEC_NODE + ' ' + cmd, true))
        }
        await Promise.all(promises)
        // log('all child processes completed: ' + jobId, 1)
        let jsonOut = []
        for (let i = 0; i < files.length; i++) {
          let _file
          if (useRedisData) {
            _file = await dbRedis.get(files[i] + '_out')
            await dbRedis.del(files[i] + '_out')
          } else {
            _file = fs.readFileSync(files[i])
            fs.rmSync(files[i])
          }
          const data = JSON.parse(_file)
          jsonOut = [...jsonOut, ...data] // Combine split files into output
        }
        if (jsonOut.length !== jsonL) {
          throw 'ERROR: files were munged during translation: ' + jsonOut.length + ' !=== ' + jsonL
        }
        if (!useRam) {
          fs.writeFileSync(batchJsonFile, stringify(jsonOut, null, 4))
        }
        await finalize(batchJsonFile, beforestats.size)
        return jsonOut
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
        if (!useRam) {
          fs.writeFileSync(batchJsonFile, stringify(json, null, 4))
        }
        await finalize(batchJsonFile, beforestats.size)
        return json
      }
    } catch (error) {
      logError(error)
      process.exit()
    }
  }
}

const finalize = async (batchJsonFile, beforeSize) => {
  if (!useRam) {
    const afterestats = await fs.statSync(batchJsonFile)
    const diff = beforeSize - afterestats.size
    log('NOTICE: Address Conversion saved ' + diff + ' bytes on this batch.', 2)
  }
  stop('Convert Batch', true)
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