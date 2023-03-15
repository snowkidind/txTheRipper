const fs = require('fs')
const env = require('node-env-file')
env(__dirname + '/.env')
const readline = require('node:readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

/* 
  Write to the paused file in order to stop new jobs/processes from starting during sync
*/

const pauseFile = process.env.BASEPATH + 'derived/application/pause'

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

const pause = async () => {
  fs.writeFileSync(pauseFile, 'true')
}

const getAnswer = (message) => {
  return new Promise((resolve) => {
    rl.question(message + '\n > ', async (answer) => {
      if (answer === 'c') {
        console.log('Operation Cancelled')
        process.exit()
        return
      }
      resolve(answer)
    })
  })
}

;(async () => {
  const paused = await checkPaused()
  console.log('Current status is ' + paused)
  const answer = await getAnswer('Pause?')
  if (answer === 'y') {
    pause()
    console.log('Status is: ' + await checkPaused())
  } else {
    console.log('Operation Cancelled')
  }
  process.exit()
})()