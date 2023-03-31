const env = require('node-env-file')
const fs = require('fs')
env(__dirname + '/../../../.env')

const { randomString } = require('../../../utils/system.js')
const net = require('net')
const identifier = 'AccountSniffer'

/* 
  Example application listen for events related to subscriptions
*/

let buffer = ''

client = net.createConnection({ path: process.env.SUB_UNIX_SOCKET }, () => {
  // in more complex cases you might want to add an id which is returned in the response, ok to omit
  const config = { identifier: identifier, type: 'setListener', id: randomString(8) } 
  client.write(JSON.stringify(config))
})

// Sometimes the data comes in over chunks so the stream is buffered and popped to combine those entries
client.on('data', (data) => {
  try {
    buffer += data.toString()
    const queries = buffer.split('\n')
    buffer = queries.pop()
    for (let i = 0; i < queries.length; i++) {
      if (queries[i].length > 0) {
        try {
          const info = JSON.parse(queries[i])     
          console.log(info)
        } catch (error) {
          console.log(queries[i])
          console.log(error)
          process.exit()
        }
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
