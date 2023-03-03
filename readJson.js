const fs = require('fs')
const env = require('node-env-file')
const { exec } = require('child_process')
env(__dirname + '/.env')
const { multiEth } = require('./utils')
const { determineJobs } = require('./jobs.js')

const basepath = process.env.BASEPATH + '/derived/transactions/'

// Displays a count of remaining blocks for active jobs

;( async () => {
  const lastBlock = await multiEth.getLastBlock('mainnet')
  const jobs = await determineJobs(lastBlock) // at this stage this only checks if jobs havent been started.
  
  for (key in jobs) {
    for (hth in jobs[key]) {
      const dir = fs.readdirSync(basepath + key + '/' + hth)
      let highFile = 0
      dir.forEach((f) => {
        if (f.includes('.json')) {
          const height = Number(f.replace('.json', ''))
          if (height > highFile) {
            highFile = height
          }
        }
      })
      const fileName = Number(key) + Number(hth)
      const pathDir = basepath + key + '/' + hth
      const path = basepath + key + '/' + hth + '/' + highFile + '.json'
      if (jobs[key][hth] === 'progress') {
        if (!fs.existsSync(path)) {
          console.log('processing blocks 0 - 1000 of 100k' + path)
          continue
        }
        const jsonRaw = fs.readFileSync(path)
        const size = await fileSize(pathDir)
        const json = JSON.parse(jsonRaw)
        const remaining = fileName + 100000 - json[json.length - 1].block
        console.log('processing: ' + json[json.length - 1].block + ' of 100k, ' + remaining + ' remaining. ' + size)
        delete json
        delete jsonRaw
      } else if (jobs[key][hth] === 'complete') {

        console.log('completed job: ' + key + ' -> ' +  hth + ' lastBlock: ')
      } else if (jobs[key][hth] === 'fucked') {
        const jsonRaw = fs.readFileSync(path)
        const json = JSON.parse(jsonRaw)
        const remaining = fileName + 100000 - json[json.length - 1].block
        console.log('fucked job: ' + key + ' -> ' + hth + ' lastBlock: ' + json[json.length - 1].block + ' path:' + path + ', ' + remaining + ' remaining. ')
      }
    }
  }
  process.exit()
})()


const fileSize = (path) => {
  return new Promise((resolve) => {
    let result = ''
    exec('du -h ' + path, (error, stdout, stderr) => {
      if (error) { console.log(error.message) }
      if (stderr) { console.log(stderr) }
      result = stdout.replace(/\n*$/, "")
      resolve(result)
    })
  })
}