const { exec } = require('child_process')
const { log } = require('../utils/log')

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
        if (logging) log(stdout.replace(/\n*$/, ""), 1)
        resolve()
      })
    })
  }
}
