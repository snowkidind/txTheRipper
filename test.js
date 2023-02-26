const env = require('node-env-file')
env(__dirname + '/.env')
const ethers = require('ethers')
const fs = require('fs')

const perf = require('execution-time')()
const { v4 } = require('uuid')

const { determineJobs, nextAvailableJob } = require('./jobs.js')
const { multiEth } = require('./utils')


const sleep = (m) => {
  return new Promise(r => setTimeout(r, m))
}

;( async () => {

  
  const lastBlock = await multiEth.getLastBlock('mainnet')
  const jobs = await determineJobs(lastBlock)
  const job = await nextAvailableJob(jobs)
  if (job === false) {
    console.log('No more jobs.')
    return
  }
  console.log('Beginning Job: ', job.block)

  const all = v4()
  perf.start(all)
  
  await sleep(15000)

  const allDuration = perf.stop(all)
  console.log('Job ' + job.block + ' completed in ' + allDuration.preciseWords)

})()