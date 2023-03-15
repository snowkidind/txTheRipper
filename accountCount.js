const env = require('node-env-file')
env(__dirname + '/.env')
const fs = require('fs')
const { dbTopic } = require('./db')
const accountFile = __dirname + '/derived/popular/topAccts.json'

// this should be piped into the identifying script because theres no point in 
// burning the ssd out on calls for tether and weth counts
;(async () => {

  const _file = fs.readFileSync(accountFile)
  const file = JSON.parse(_file)
  for (let i = 0; i < file.length; i++) {
    const count = await dbTopic.txCount(file[i].account)
    console.log(file[i].account + ': '+ count)
    process.exit()
  }

})()