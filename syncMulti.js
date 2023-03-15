const fs = require('fs')
const util = require('util')
const env = require('node-env-file')
env(__dirname + '/.env')
const { multiEth, signal } = require('./utils')
const { determineJobs, nextAvailableJob, lastCompletedJob } = require('./jobs.js')
const { markTask } = require('./db/transactions.js')
const { exec } = require('child_process')


// Set the number of processes simultaneously, each given its own sandbox in memory
const numberOfWorkers = 5
const pauseFile = process.env.BASEPATH + 'derived/application/pause'
const runFile = process.env.BASEPATH + 'derived/application/run'

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

/* Paused means to no longer add any more jobs to the queue. */
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

    if (await checkPaused()) {
      const message = 'Cannot start txRipper synchronization. Application is paused.'
      console.log(message)
      await signal.sendMessageToGroup(message, process.env.SIGNAL_GROUP_NOTIFICATIONS)
      process.exit(1)
    }

    // await signal.sendMessageToGroup('Starting TxRipper synchronization...', process.env.SIGNAL_GROUP_NOTIFICATIONS)

    // Determine if there are any jobs to do...
    const lastBlock = await multiEth.getLastBlock('mainnet')
    let inProgress = true
    let totalJobsDeployed = 0

    // Regardless of the status of this file, set process to the latest run here. 
    // Yes, bugs will occur when more than one instance of this is run simultaneously
    if (!fs.existsSync(runFile)) {
      fs.writeFileSync(runFile, JSON.stringify({}))
    }
    fs.writeFileSync(runFile, JSON.stringify({ process: process.pid, jobs: [] })) // overwrite any former ids

    // deploy the worker
    const worker = async () => {
      const jobs = await determineJobs(lastBlock) // at this stage this only checks if jobs havent been started.
      const job = await nextAvailableJob(jobs, false)
      if (job === false) {
        // If there are no more jobs, there still may be a diff between last block and last synced block.
        const lastCompleted = await lastCompletedJob(jobs)
        const diff = lastBlock - lastCompleted.taskBlock
        // When there is a difference between the highest block indexed and the last block mined
        // This should be greater than n confirmations in order to prevent reorg based garbage in DB
        console.log('The diff is: ' + diff + ' lastNode: ' + lastBlock + ' lastIndexed: ' + lastCompleted.taskBlock)
        if (diff > 35) {
          // mark the sync file as progress in order to process it on the next cycle
          // unless we are currently already syncing
          // the job to be marked must not already be in progress
          let working = false
          const _run = fs.readFileSync(runFile, 'utf8')
          const run = JSON.parse(_run)
          run.jobs.forEach((currentJob) => {
            if (currentJob.mill === lastCompleted.highJob && currentJob.hth === lastCompleted.highTask) {
              working = true
              console.log('Already working on this task...')
            }
          })
          if (!working) {
            await markTask('progress', lastCompleted.highJob, lastCompleted.highTask)
            console.log('Last task was marked to be updated because index is: ' + diff + ' blocks behind.')
          }
        } else {
          // this can occur if the node gets stopped for some reason, or script gets called too soon
          console.log('No more jobs.')
        }
        inProgress = false
        return
      }
      console.log('deploying new worker ' + job.block + ' total jobs deployed: ' + totalJobsDeployed)
      totalJobsDeployed += 1
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
      }
      await sleep(5000) // pause to allow filesystem to catch up, and crash on only one sub process instead of all of them if it so may be
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
    // await signal.sendMessageToGroup('Awaiting Completion of remaining jobs...', process.env.SIGNAL_GROUP_NOTIFICATIONS)
    await Promise.all(workers) // in case any workers are still working
    console.log('Process Complete, deployed: ' + totalJobsDeployed + ' jobs.')
    // await signal.sendMessageToGroup('TxRipper Synchronization Completed!', process.env.SIGNAL_GROUP_NOTIFICATIONS)
  } catch (error) {
    console.log(error)
    await signal.sendMessageToGroup('TxRipper Error occurred in main: ' + JSON.parse(error, null, 4), process.env.SIGNAL_GROUP_NOTIFICATIONS)
  }
}

  ; (async () => {
    await main()
    fs.writeFileSync(pauseFile, 'false')
    process.exit(0)
  })()