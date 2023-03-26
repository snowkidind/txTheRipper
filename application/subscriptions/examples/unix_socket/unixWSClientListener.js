const env = require('node-env-file')
const fs = require('fs')
env(__dirname + '/../../../../.env')

const { randomString } = require('../../../../utils/system.js')
const net = require('net')
const identifier = 'AccountSniffer'

/* 
  Example application listen for events related to subscriptions
*/

client = net.createConnection({ path: process.env.SUB_UNIX_SOCKET }, () => {
  const config = { identifier: identifier, type: 'setListener', id: randomString(8) } // do we still need the id param?
  client.write(JSON.stringify(config))
})

client.on('data', (data) => {
  try {
    const queries = data.toString().split('\n')
    for (let i = 0; i < queries.length; i++) {
      if (queries[i].length > 0) {
        const info = JSON.parse(queries[i])
        console.log(info)
      }
    }
  } catch (error) {
    console.log(error)
    console.log(data.toString())
  }
})

client.on('end', () => {
  console.log('disconnected from server')
  client.destroy()
  process.exit()
})
