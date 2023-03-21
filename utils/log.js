const fs = require('fs')
const { dateNowBKK, timeFmtDb } = require('./date.js')

const logLevel = process.env.LOG_LEVEL
if (typeof logLevel === 'undefined') {
  console.log('ERROR: Log Level is not set in .env')
  process.exit()
}

const _logToFile = process.env.LOG_TO_FILE
const logToFile = typeof _logToFile == 'undefined' ? false : _logToFile.trim()
const logFilePath = process.env.LOG_FILE_LOCATION || process.env.BASEPATH + 'derived/application/log.txt'

module.exports = {
  log: (message, level, object) => {
    const log = (message) => { 
      const msg = timeFmtDb(dateNowBKK()) + ' ' + message
      console.log(msg)
      if (logToFile === 'true') {
        fs.appendFileSync(logFilePath, msg + '\n')
      }
    }
    if (logLevel == 1 && level == 1) { log(message) }
    else if (logLevel == 2 && ( level == 2 || level == 1)) { log(message) }
    else if (logLevel == 3 && (level == 3 || level == 2 || level == 1)) { log(message) }
    else if (logLevel == 4) {
      if (object) console.log(object)
      log(message)
    } else if (!level) {
      console.log('WARNING: Calling log without setting log level try: log(message, level, object)')
      log(message)
    }
  },

  logToFile: (message) => {
    if (logToFile === 'true') {
      fs.appendFileSync(logFilePath, message + '\n')
    }
  },

  logError: (error, message) => {
    if (typeof message === 'undefined') message = ''
    const msg = timeFmtDb(dateNowBKK()) + ' ' + message + '\n'
    console.log(error)
    console.log(msg)
    if (error && error.stack) { 
      fs.appendFileSync(logFilePath, error.stack.toString())
    } else if (typeof error !== 'undefined') {
      fs.appendFileSync(logFilePath, error.toString())
    }
    fs.appendFileSync(logFilePath, msg + '\n')
  },

  clearLog: () => {
    fs.writeFileSync(logFilePath, '')
  },

  printLogo: () => {
    logo()
  }
}


const logo = () => {

const l =   
`
888888 Yb  dP     88""Yb 88 88""Yb 88""Yb 888888 88""Yb 
  88    YbdP   T  88__dP 88 88__dP 88__dP 88__   88__dP 
  88    dPYb   H  88"Yb  88 88"""  88"""  88""   88"Yb  
  88   dP  Yb  E  88  Yb 88 88     88     888888 88  Yb 

@SNOWKIDIND https://github.com/snowkidind/txTheRipper
`
  console.log(l)
  if (logToFile === 'true') {
    fs.appendFileSync(logFilePath, l + '\n')
  }
}