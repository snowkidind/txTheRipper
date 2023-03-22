const { start, stop } = require('../utils/jobTimer.js')

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }

( async () => {

  const block = 6500000
  const top = 17000000

  for (let block = 0; i < 4; i++) {
    start('test')
    await sleep(1000)
    const data = stop('test')
    console.log(data)
    // ?? how many blocks are being processed per chunk?
  }


})()