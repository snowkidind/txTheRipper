
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
  }
}
