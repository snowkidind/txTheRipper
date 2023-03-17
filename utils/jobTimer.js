const perf = require('execution-time')()
const { v4 } = require('uuid')
const { log, logError } = require('../utils/log')

const jobs = []

exports.start = (title) => {
  const job = v4()
  perf.start(job, title)
  jobs.push({ job: job, title: title })
}

exports.stop = (title, logTimes) => {
  let job
  jobs.forEach((j) => {
    if (j.title === title) {
      job = j.job
    }
  })
  const allDuration = perf.stop(job)
  const message = 'Job ' + title + ' completed in ' + allDuration.preciseWords
  if (logTimes)  log(message, 1)
  return allDuration
}

exports.getId = () => {
  return v4()
}
