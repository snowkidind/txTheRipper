const crypto = require('crypto')
const decimals = require('./decimals.js')
let oldConsoleLog = null

module.exports = {
  sleep: function (m) {
    return new Promise(r => setTimeout(r, m))
  },

  getRandomBytes: (length = 16) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(length, (err, randomBytes) => {
        if (err) {
          reject(err)
        } else {
          resolve(randomBytes)
        }
      })
    })
  },

  time: function (epoch) {
    const date = new Date(epoch * 1000)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
    let minutes = date.getMinutes()
    if (minutes < 10) minutes = '0' + String(minutes)
    const fullDate = (Number(date.getDate())) + ' ' + months[date.getMonth()] + ', ' + date.getHours() + ':' + minutes
    return { display: fullDate, epoch: epoch }
  },

  timeFmt: function (epoch) {
    const date = new Date(epoch * 1000)
    let minutes = date.getMinutes()
    if (minutes < 10) minutes = '0' + String(minutes)
    let seconds = date.getSeconds()
    if (seconds < 10) seconds = '0' + String(seconds)
    const month = date.getMonth() + 1
    const ms = date.getMilliseconds()
    const fullDate = (Number(date.getFullYear())) + '-' + month + '-' + date.getDate() + ' ' + date.getHours() + ':' + minutes + ':' + seconds + '.' + ms
    return { display: fullDate, epoch: epoch }
  },

  enableLogger: function () {
    if (oldConsoleLog == null)
      return
    console.log = oldConsoleLog
  },

  disableLogger: function () {
    oldConsoleLog = console.log
    console.log = function () {
    }
  },

  calcAPY: function (principal, start, realized) {
    if (principal > 0 && realized > 0) {

      const oneYear = 31536000
      const now = Math.round(new Date().getTime() / 1000)

      const duration = now - start
      const unrealizedTime = oneYear - duration // time left in period
      const multiplier = unrealizedTime / oneYear
      const multOpp = Math.abs(multiplier - 1)

      const projectedGains = realized / multOpp
      // const projected = projectedGains + realized // this compounds the result
      const apyDecimal = projectedGains / principal
      const apyPerc = apyDecimal * 100

      return { apyDecimal: apyDecimal, apyPerc: decimals.round(apyPerc, 2) }
    } else {
      console.log("utils.calcAPY encountered bad input parameters: " + principal, start, realized)
      return { apyDecimal: -1, apyPerc: -1 }
    }
  },

  splitInterval: (_interval) => {
    let interval, aggregate
    switch (_interval.toLowerCase()) {
      case 'm':
      case '1m':
        interval = "minute"
        aggregate = 1
        break;
      case '3m':
        interval = "minute"
        aggregate = 3
        break;
      case '5m':
        interval = "minute"
        aggregate = 5
        break;
      case '15m':
        interval = "minute"
        aggregate = 15
        break;
      case '30m':
        interval = "minute"
        aggregate = 30
        break;
      case 'h':
      case '1h':
        interval = "hour"
        aggregate = 1
        break;
      case '2h':
        interval = "hour"
        aggregate = 2
        break;
      case '4h':
        interval = "hour"
        aggregate = 4
        break;
      case '6h':
        interval = "hour"
        aggregate = 6
        break;
      case '8h':
        interval = "hour"
        aggregate = 8
        break;
      case '12h':
        interval = "hour"
        aggregate = 12
        break;
      case 'd':
      case '1d':
        interval = "day"
        aggregate = 1
        break;
      case '3d':
        interval = "day"
        aggregate = 3
        break;
      case '7d':
        interval = "day"
        aggregate = 7
        break;
      case '30d':
        interval = "day"
        aggregate = 30
        break;
      default:
        interval = "day"
        aggregate = 1
        break;
    }
    return { interval: interval, aggregate: aggregate }
  }
}
