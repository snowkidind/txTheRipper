
module.exports = {

  timeFmtDb: (e) => {
    let epoch = e
    if (epoch.length === 10) epoch = e * 1000
    const date = new Date(epoch) // this unfortunately uses the local time
    let minutes = date.getMinutes();
    if (minutes < 10) minutes = '0' + String(minutes);
    let seconds = date.getSeconds();
    if (seconds < 10) seconds = '0' + String(seconds);
    let hours = date.getHours();
    let day = date.getDate()
    if (day < 10) day = '0' + String(day);
    if (hours < 10) hours = '0' + String(hours);
    let month = date.getMonth() + 1;
    if (month < 10) month = '0' + month;
    return (Number(date.getFullYear())) + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
  },

  epochFromDate: (date) => {
    return new Date(date).getTime()
  },

  dateNowBKK: () => {
    return Date.now()
  },

  dateNowUTC: () => {
    const now = Date.now()
    const offset = Number(process.env.UTC_TZ_OFFSET) || 1
    const backInTime = now - (3600000 * offset)
    return backInTime
  }
}

/*
  randomTimeInRange: (past = 1419958800000, future = 1784941200000) => {
    const randomTime = (min, max) => { // min and max included 
      return Math.floor(Math.random() * (max - min + 1) + min)
    }
    const date = randomTime(past, future)
    const stamp = module.exports.timeFmtDb(date)
    const chop = stamp.substring(0, stamp.length - 3)
    const rand = String(randomTime(0, 999999))
    return chop + rand.padEnd(6, '0')
  },

  timeFmtYMD: (e) => {
    let epoch = e
    if (epoch.length === 10) epoch = e * 1000
    const date = new Date(epoch) // this unfortunately uses the local time
    let day = date.getDate()
    if (day < 10) day = '0' + String(day);
    let month = date.getMonth() + 1;
    if (month < 10) month = '0' + month;
    return (Number(date.getFullYear())) + '-' + month + '-' + day;
  },

  timeFmtShort: (e) => {
    let epoch = e
    if (epoch.length === 10) epoch = e * 1000
    const date = new Date(epoch) // this unfortunately uses the local time
    let minutes = date.getMinutes();
    if (minutes < 10) minutes = '0' + String(minutes);
    let hours = date.getHours();
    let day = date.getDate()
    if (day < 10) day = '0' + String(day);
    if (hours < 10) hours = '0' + String(hours);
    let month = date.getMonth() + 1;
    if (month < 10) month = '0' + month;
    return (month + '/' + day + ' ' + hours + ':' + minutes)
  },

  timeFmtMed: (e) => {
    let epoch = e
    if (epoch.length === 10) epoch = e * 1000
    const date = new Date(epoch) // this unfortunately uses the local time
    let minutes = date.getMinutes();
    if (minutes < 10) minutes = '0' + String(minutes);
    let hours = date.getHours();
    let day = date.getDate()
    if (day < 10) day = '0' + String(day);
    if (hours < 10) hours = '0' + String(hours);
    let month = date.getMonth() + 1;
    if (month < 10) month = '0' + month;
    return (Number(date.getFullYear())) + '-' + month + '-' + day + '_' + hours + ':' + minutes
  },

  timeFmtDbMs: (epoch) => {
    const date = new Date(epoch)
    let minutes = date.getMinutes()
    if (minutes < 10) minutes = '0' + String(minutes)
    let seconds = date.getSeconds()
    if (seconds < 10) seconds = '0' + String(seconds)
    let hours = date.getHours()
    let day = date.getDate()
    let ms = date.getMilliseconds()
    if (day < 10) day = '0' + String(day)
    if (hours < 10) hours = '0' + String(hours)
    let month = date.getMonth() + 1
    if (month < 10) month = '0' + month
    return (Number(date.getFullYear())) + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds + '.' + ms
  },

  iso8601: (e) => {
    let epoch = e
    if (epoch.length === 10) epoch = e * 1000
    const date = new Date(epoch) // this unfortunately uses the local time
    let minutes = date.getMinutes()
    if (minutes < 10) minutes = '0' + String(minutes)
    let seconds = date.getSeconds()
    if (seconds < 10) seconds = '0' + String(seconds)
    let hours = date.getHours()
    let day = date.getDate()
    if (day < 10) day = '0' + String(day)
    if (hours < 10) hours = '0' + String(hours)
    let month = date.getMonth() + 1
    if (month < 10) month = '0' + month
    return (Number(date.getFullYear())) + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds + '.000Z'
  },

  dateNowUTCdb: () => {
    const now = Date.now()
    const offset = Number(process.env.UTC_TZ_OFFSET) || 1
    const backInTime = now - (3600000 * offset)
    return module.exports.timeFmtDb(backInTime)
  },

  localTimeToDbTime: (epoch) => {
    const offset = Number(process.env.UTC_TZ_OFFSET) || 1
    return epoch - (3600000 * offset)
  },

  offsetDateByTzHours: (dbDate) => {
    const offset = Number(process.env.UTC_TZ_OFFSET) || 1
    const backInTime = module.exports.epochFromDate(dbDate) - (3600000 * offset)
    return module.exports.timeFmtDb(backInTime)
  },

  offsetEpochByTzHours: (epoch) => {
    const offset = Number(process.env.UTC_TZ_OFFSET) || 1
    const backInTime = epoch - (3600000 * offset)
    return backInTime
  },

  offsetEpochByTzHoursToDbDate: (epoch) => {
    const offset = Number(process.env.UTC_TZ_OFFSET) || 1
    const backInTime = epoch - (3600000 * offset)
    return module.exports.timeFmtDb(backInTime)
  },

  nearestLastHour: () => {
    const date = module.exports.timeFmtDb(new Date())
    return date.substr(0, 13) + ':00:00.000'
  },

  nearestLastMinute: (epoch) => {
    const date = module.exports.timeFmtDb(epoch)
    return date.substr(0, 16) + ':00.000'
  },

  nearestLastMinute2: (epoch) => {
    const date = module.exports.timeFmtDb(epoch)
    return date.substr(0, 16) + ':00'
  },

  nearestLastMinuteS: (epoch) => {
    const date = module.exports.timeFmtDb(epoch)
    return date.substr(0, 16) + ':00'
  },

  nearestNextMinute: (epoch) => {
    const date = module.exports.timeFmtDb(epoch)
    const nextMinute = module.exports.epochFromDate(date.substr(0, 16) + ':00.000') + 60000
    return module.exports.timeFmtDb(nextMinute)
  },

  nearestNextDay: (epoch) => {
    const date = module.exports.timeFmtDb(epoch)
    const today = date.substr(0, 10) + ' 00:00:00.000'
    const tomorrow = module.exports.epochFromDate(today) + 86400000
    return module.exports.timeFmtDb(tomorrow)
  },

  nearestLastDay: (date) => {
    const dateStd = module.exports.timeFmtDb(date)
    return dateStd.substr(0, 10) + ' 00:00:00.000'
  },

  dmy: (date) => {
    const dateStd = module.exports.timeFmtDb(date)
    return dateStd.substr(0, 10)
  },

  lastThirtyDays: (includeToday) => {
    const last = module.exports.epochFromDate(module.exports.nearestLastDay(Date.now()))
    let laster = last
    let thirty = []

    if (includeToday) {
      // today = laster + 86400000 -- tomorrow
      thirty.push(module.exports.timeFmtDb(laster).substr(0, 10))
    }

    for (let i = 0; i < 30; i++) {
      laster = laster - 86400000
      thirty.push(module.exports.timeFmtDb(laster).substr(0, 10))
    }
    return thirty
  },


  lastNDays: (includeToday, n) => {
    const last = module.exports.epochFromDate(module.exports.nearestLastDay(Date.now()))
    let laster = last
    let thirty = []

    if (includeToday) {
      // today = laster + 86400000 -- tomorrow
      thirty.push(module.exports.timeFmtDb(laster).substr(0, 10))
    }

    for (let i = 0; i < n; i++) {
      laster = laster - 86400000
      thirty.push(module.exports.timeFmtDb(laster).substr(0, 10))
    }
    return thirty
  },

  nextPeriodOpen: (openAt, maturityPeriodHours) => {
    const epoch = module.exports.epochFromDate(openAt)
    const mpms = 1000 * 60 * 60 * maturityPeriodHours
    let head = epoch
    let buffer = module.exports.epochFromDate(new Date())
    buffer += mpms//  + 1000
    let lastHead = epoch
    while (head < buffer) {
      lastHead = head
      head = head + mpms
    }
    return module.exports.timeFmtDb(lastHead)
  },

  isUTCFourHourInterval: () => {
    const hours = [3, 7, 11, 15, 19, 23]
    const date = module.exports.timeFmtDb(module.exports.dateNowBKK())
    const hour = Number(date.substring(11, 13))
    for (let i = 0; i < 5; i++) {
      if (hours[i] === hour) {
        return true
      }
    }
    return false
  },
*/
  // /*
  // * determine the epoch range of the last periods
  // * this snaps periods to the latest date, not the current time, leaving an 
  // * incomplete period at the bottom of the stack. setting returnIncompletePeriod to false 
  // * removes the incompleted period, true includes it. numOfPeriods returned will always be 
  // * numberOfPeriods regardless
  // * Array of periods is returned sorted with newest period at index 0 
  // * duration string '1m', '15m', '1h', '4h', 'd', 'w'
  // */
  
/*
  determinePeriods: (duration, numOfPeriods, returnIncompletePeriod = false, fromDate = new Date()) => {

    const now = module.exports.epochFromDate(fromDate) // in ms
    const fmt = module.exports.timeFmtDb(now).substring(0, 10)
    const day = new Date(fmt)
    const interval = module.exports.lookupInterval(duration)
    const newDay = day.getTime()
    // generate forward periods from new day
    let periods = []
    let head = newDay
    while (head <= now + interval) {
      periods.push([head, head + interval - 1])
      head = head + interval
      // periods.push([head, head + interval - 1])
    }
    // exit 1: periods are less than the last new date
    if (periods.length > numOfPeriods) {
      periods.reverse()
      if (returnIncompletePeriod) {
        return periods.slice(0, numOfPeriods);
      }
      return periods.slice(1, numOfPeriods);
    }
    // generate backward periods from new day until req fulfilled
    head = newDay
    while (periods.length <= numOfPeriods - 1) {
      head = head - interval
      periods.push([head, head + interval - 1])
    }
    periods.sort((a, b) => (a[0] > b[0]) ? 1 : -1)
    periods.reverse()
    if (returnIncompletePeriod) {
      return periods.slice(0, numOfPeriods);
    }
    return periods.slice(1, numOfPeriods);
  },

  periodsPerDay: (duration, fromDate) => {
    const interval = module.exports.lookupInterval(duration) // returns ms
    const today = module.exports.epochFromDate(module.exports.nearestLastDay(fromDate))
    const tomorrow = module.exports.epochFromDate(module.exports.nearestNextDay(fromDate))
    let i = 0
    let head = today
    let periods = []
    while (head <= tomorrow) {
      periods.push(head)
      head = head + interval
    }
    return periods
  },

  getMinuteGrid: (f, t) => {

    const f1 = f * 1000
    const t1 = t * 1000 // + 60000 // add a forward buffer to the grid to catch unspent minutes
    const from = module.exports.epochFromDate(module.exports.nearestLastMinute(f1))
    const to = module.exports.epochFromDate(module.exports.nearestLastMinute(t1))
    const period = 1000 * 60
    let grid = []
    let head = from
    while (head < to) {
      grid.push([head, head + period - 1, [], module.exports.timeFmtDb(head), module.exports.timeFmtDb(head + period - 1)])
      head = head + period
    }
    return grid
  },

  nearestInterval: (epoch, minutes, up) => {
    const ms = 1000 * 60 * minutes;
    if (up === true) {
      return new Date(Math.ceil(epoch / ms) * ms)
    }
    return new Date(Math.floor(epoch / ms) * ms)
  },


  // returnIncompletePeriod means the period at the end will contain time in the future of the ending time. 
  getGrid: (begin, ending, minutes, returnIncompletePeriod = true) => {
    const from = new Date(begin).getTime()
    const to = new Date(ending).getTime()
    const period = minutes * 60 * 1000
    let grid = []
    let head = from
    while (head <= to) {
      grid.push([head, head + period - 1, module.exports.timeFmtDb(head), []])// empty array is to store optional data
      head = head + period
    }
    if (returnIncompletePeriod === false) {
      grid = grid.slice(0, grid.length - 1)
    }
    return grid
  },


  // A grid where the end time is the key
  getReverseGrid: (ending, begin, minutes, returnIncompletePeriod = true) => {
    const from = new Date(begin).getTime()
    const to = new Date(ending).getTime()
    const period = minutes * 60 * 1000
    let grid = []
    let head = from
    while (head <= to) {
      grid.push([head - period + 1, head, module.exports.timeFmtDb(head), []])// empty array is to store optional data
      head = head + period
    }
    if (returnIncompletePeriod === false) {
      grid = grid.slice(0, grid.length - 1)
    }
    grid = grid.slice(1, grid.length)
    return grid
  },


  //  * Return the interval of a given period

  lookupInterval: (interval) => {
    validInterval = {
      '1m': 60000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
      'w': 604800000,
      'm': 2628000000
    }
    if (typeof interval === 'string') {
      const lookup = interval.toLowerCase()
      if (validInterval.hasOwnProperty(lookup)) return validInterval[lookup]
    }
    return { error: 'dateutils: invalid interval supplied: ' + interval, intervals: validInterval }
  },

  recentMonths: (numOfMonths) => {

    function newYear(year) {
      let thisYearDates = []
      // next prev full year
      month = 12
      while (month > 0) {
        let mo = String(month)
        if (Number(mo) < 10) mo = '0' + mo
        thisYearDates.push(year + '-' + mo + '-01 00:00:00.000')
        month -= 1;
      }
      return thisYearDates
    }

    const now = module.exports.timeFmtDb(new Date()).substr(0, 7)
    const chunks = now.split('-')
    let year = chunks[0]

    // first partial year
    let dates = []
    while (chunks[1] > 0) {
      let mo = String(chunks[1])
      if (Number(mo) < 10) mo = '0' + mo
      dates.push(year + '-' + mo + '-01 00:00:00.000')
      chunks[1] -= 1;
    }

    while (dates.length < numOfMonths) {
      year = year - 1
      dates = [...dates, ...newYear(year)]
    }

    return dates.slice(0, numOfMonths)
  },

  futureDate: (value, string, fromDate = module.exports.dateNowBKK()) => {
    let future
    switch (string) {
      case 'minutes':
        future = fromDate + Number(value) * 60 * 1000
        break
      case 'hours':
        future = fromDate + Number(value) * 3600 * 1000
        break
      case 'days':
        future = fromDate + Number(value) * 86400 * 1000
        break
      case 'weeks':
        future = fromDate + Number(value) * 604800 * 1000
        break
    }
    return module.exports.timeFmtDb(future)
  },

  pastDate: (value, string, fromTime) => {
    let now = fromTime
    if (typeof fromTime === 'undefined') {
      now = module.exports.dateNowBKK()
    }
    let future
    switch (string) {
      case 'minutes':
        future = now - Number(value) * 60 * 1000
        break
      case 'hours':
        future = now - Number(value) * 3600 * 1000
        break
      case 'days':
        future = now - Number(value) * 86400 * 1000
        break
      case 'weeks':
        future = now - Number(value) * 604800 * 1000
        break
    }
    return module.exports.timeFmtDb(future)
  }

*/
