const fs = require('fs')
const util = require('util')
const env = require('node-env-file')
env(__dirname + '/.env')
const { multiEth, signal } = require('./utils')
const { determineJobs, nextAvailableJob } = require('./jobs.js')
const { exec } = require('child_process')


// Set the number of processes simultaneously, each given its own sandbox in memory
const numberOfWorkers = 5
const pauseFile = process.env.BASEPATH + 'derived/application/pause'

const syncOne = () => {
  return new Promise((resolve) => {
    exec(process.env.EXEC_NODE + " " + process.env.BASEPATH + "sync.js", (error, stdout, stderr) => {
      if (error) { console.log(error.message) }
      if (stderr) { console.log(stderr) }
      console.log(stdout.replace(/\n*$/, ""))
      resolve()
    })
  })
}

// Used for test purposes
const syncOneth = () => {
  console.log('NOTCIE: test mode')
  return new Promise((resolve) => {
    exec(process.env.EXEC_NODE + " " + process.env.BASEPATH + "test.js", (error, stdout, stderr) => {
      if (error) { console.log(error.message) }
      if (stderr) { console.log(stderr) }
      console.log(stdout.replace(/\n*$/, ""))
      resolve()
    })
  })
}

const sleep = (m) => {
  return new Promise(r => setTimeout(r, m))
}

const checkPaused = async () => {
  if (!fs.existsSync(pauseFile)) {
    fs.writeFileSync(pauseFile, 'false') // true only if paused
  }
  const status = await fs.readFileSync(pauseFile, 'utf8')
  if (status === 'true') {
    return true
  }
  return false
}

const main = async () => {
  try {
    
    await signal.sendMessageToGroup('Starting TxRipper Synchronization...', process.env.SIGNAL_GROUP_NOTIFICATIONS)

    // Determine if there are any jobs to do...
    const lastBlock = await multiEth.getLastBlock('mainnet')
    let inProgress = true
    let totalJobsDeployed = 0

    // deploy the worker
    const worker = async () => {
      const jobs = await determineJobs(lastBlock) // at this stage this only checks if jobs havent been started.
      const job = await nextAvailableJob(jobs)
      if (job === false) {
        console.log('No more jobs.')
        inProgress = false
        return
      }
      console.log('deploying new worker ' + job.block + ' total jobs deployed: ' + totalJobsDeployed)
      await syncOne() // resolves when complete
    }

    // Routine to progressively handle jobs, allowing numberOfWorkers to operate simultaneously
    const workers = []
    while (inProgress) {
      if (await checkPaused()) {
        inProgress = false
        console.log('found paused flag. Not adding any more Jobs')
      }
      if (workers.length < numberOfWorkers) {
        workers.push(worker())
        totalJobsDeployed += 1
      }
      await sleep(1000) // pause to allow filesystem to catch up
      let indexToRemove = -1
      for (let i = 0; i < workers.length; i++) {
        if (util.inspect(workers[i]).includes("undefined")) { // hack to detect fulfilled promises
          indexToRemove = i
        }
      }
      if (indexToRemove !== -1) {
        workers.splice(indexToRemove, 1)
      }
    }

    // finish the process
    console.log('Awaiting Remaining Jobs...')
    await signal.sendMessageToGroup('Awaiting Completion of remaining jobs...', process.env.SIGNAL_GROUP_NOTIFICATIONS)
    await Promise.all(workers) // in case any workers are still working
    console.log('Process Complete, deployed: ' + totalJobsDeployed + ' jobs.')
    await signal.sendMessageToGroup('TxRipper Synchronization Completed!', process.env.SIGNAL_GROUP_NOTIFICATIONS)
  } catch (error) {
    console.log(error)
  }
}

  ; (async () => {
    await main()
    process.exit(0)
  })()