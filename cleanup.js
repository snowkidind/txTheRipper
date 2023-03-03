const fs = require('fs')
const env = require('node-env-file')
const { exec } = require('child_process')
env(__dirname + '/.env')
const { multiEth } = require('./utils')
const { determineJobs } = require('./jobs.js')

const basepath = process.env.BASEPATH + '/derived/transactions/'

  // Displays a count of remaining blocks for active jobs

  ; (async () => {
    const lastBlock = await multiEth.getLastBlock('mainnet')
    const jobs = await determineJobs(lastBlock) // at this stage this only checks if jobs havent been started.

    for (key in jobs) {
      for (hth in jobs[key]) {
        if (jobs[key][hth] === 'progress') {
          const dir = fs.readdirSync(basepath + key + '/' + hth)
          let highFile = 0
          dir.forEach((f) => {
            const filePath = basepath + key + '/' + hth + '/' + f
            if (f.includes('.json')) {
              console.log('removing: ' + filePath)
              fs.rmSync(filePath)
            } else if (f === 'sync') {
              fs.writeFileSync(filePath, 'new')
              console.log('updating status file: ' + filePath + ' to new')
            }
          })
        }
      }
    }
    process.exit()
  })()
