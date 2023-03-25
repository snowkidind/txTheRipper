const { exec } = require('child_process')
const { log } = require('../utils/log')
const crypto = require('crypto')

const parseDbToDisplay = (string) => {
  const lines = string.split('\n')
  lines.forEach((l) => {
    if (l !== '') log(l, 1)
  })
}

module.exports = {

  memStats: (print, title = 'System Memory Usage') => {
    const used = process.memoryUsage()
    if (print) log('', 1)
    if (print) log(title, 1)
    for (let key in used) {
      const item = Math.round(used[key] / 1024 / 1024 * 100) / 100
      if (print) log('  ' + String(key).padEnd(15) + item + ' MB', 1)
    }
    if (print) log('', 1)
    return used
  },

  execCmd: (cmd, logging = true) => {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) reject(error.message)
        if (stderr) reject(stderr)
        if (logging) parseDbToDisplay(stdout)
        resolve()
      })
    })
  },

  randomString: (length) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let password = ''
    for (let i = 0; i < length; i++) {
      const index = crypto.randomBytes(1)[0] % charset.length
      password += charset.charAt(index)
    }
    return password
  },

  randomNumber: (length) => {
    const charset = '0123456789'
    let password = ''
    for (let i = 0; i < length; i++) {
      const index = crypto.randomBytes(1)[0] % charset.length
      password += charset.charAt(index)
    }
    return password
  },

  randomPassword: (length) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789123456789!@#$%^&*!@#$%^&*!@#$%^&*'
    let password = ''
    for (let i = 0; i < length; i++) {
      const index = crypto.randomBytes(1)[0] % charset.length
      password += charset.charAt(index)
    }
    return password
  },
}
