const fs = require('fs')

const basepath = process.env.BASEPATH + '/derived/transactions/'

module.exports = {

  // A job is a range from 0 to the next 100 thousandth block
  determineJobs: async (lastBlock) => {
    let mill = Math.floor(lastBlock / 1000000) // what million are we on
    let hth = Math.floor((lastBlock - (mill * 1000000)) / 100000) // what htn are we on
    mill = mill + 1
    let grid = {}
    let millCount = mill * 1000000
    const objOfTen = { 0: '', 100000: '', 200000: '', 300000: '', 400000: '', 500000: '', 600000: '', 700000: '', 800000: '', 900000: '' }
    for (let i = 0; i < mill; i++) {
      millCount -= 1000000
      if (i === 0) {
        let populate = {}
        for (let j = 0; j <= hth; j++) {
          populate[String(j * 100000)] = ''
        }
        grid[millCount] = populate
      } else {
        grid[millCount] = objOfTen
      }
    }
    // three job statuses: in new, progress, complete
    grid = JSON.parse(JSON.stringify(grid)) // resolves an immutable issue
    for (million in grid) {
      const generation = grid[million]
      for (hndth in generation) {
        if (!fs.existsSync(basepath + million)) {
          fs.mkdirSync(basepath + million)
        }
        if (!fs.existsSync(basepath + million + '/' + hndth)) {
          fs.mkdirSync(basepath + million + '/' + hndth)
        }
        const file = basepath + million + '/' + hndth
        if (fs.existsSync(file + '/sync')) {
          const status = fs.readFileSync(file + '/sync', 'utf8')
          grid[million][hndth] = status
        } else {
          grid[million][hndth] = 'new'
          fs.writeFileSync(file + '/sync', 'new')
        }
      }
    }
    return grid
  },

  nextAvailableJob: (jobs) => {
    let job = {}
    let found = false
    for (key in jobs) {
      for (hth in jobs[key]) {
        if (jobs[key][hth] === 'new') {
          job['mill'] = key
          job['hth'] = hth
          job['status'] = jobs[key][hth]
          const block = Number(key) + Number(hth)
          job['block'] = block
          found = true
          break
        }
      }
      if (found) break
    }
    if (found === false) {
      return false
    }
    return job
  }
}