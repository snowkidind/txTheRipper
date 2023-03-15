const { exec } = require('child_process')

module.exports = {
  memStats: (print) => {
    const used = process.memoryUsage()
    for (let key in used) {
      const item = Math.round(used[key] / 1024 / 1024 * 100) / 100
      if (print) console.log(String(key).padEnd(15) + item + ' MB')
    }
    return used
  },

  execCmd: (cmd, logging = true) => {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) reject(error.message)
        if (stderr) reject(stderr)
        if (logging) console.log(stdout.replace(/\n*$/, ""))
        resolve()
      })
    })
  }
}
