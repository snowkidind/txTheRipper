const fs = require('fs')
const axios = require('axios');
const FormData = require('form-data')
const file = require('./file.js')

module.exports = {
  sendMessage: async (message, recipient) => {
    try {
      const queryString = 'recipient=' + recipient + '&message=' + message
      const resp = await axios.get(process.env.SIGNAL_SERVER + '/signal/message?' + queryString)
      if (resp.data !== 'Successfully sent message.') console.log('Signal, Abnormal Response: ', resp.data)
    } catch (error) {
      console.log(error)
      console.log('couldnt send a message to signal bot')
    }
  },

  sendMessageToGroup: async (message, groupId) => {
    try {
      const msg = encodeURI(message)
      const queryString = 'groupId=' + encodePlus(groupId) + '&message=' + msg
      const resp = await axios.get(process.env.SIGNAL_SERVER + '/signal/sendMessageToGroup?' + queryString)
      if (resp.data.status === 'ok') {
        if (resp.data.message !== 'Successfully sent message.') console.log(resp.data.message)
        return { status: 'ok' }
      }
    } catch (error) {
      console.log(error)
      console.log('couldnt send a message to signal bot')
    }
  },

  sendImageToGroup: async (filePath, fileName, message, groupId) => {
    if (!file.fileExists(filePath + fileName)) {
      console.log('could not find file...')
      return
    }
    let formData = new FormData()
    formData.append('groupId', encodePlus(groupId))
    formData.append('message', message)
    formData.append('fileName', fileName)
    formData.append('uploaded_file', fs.createReadStream(filePath + fileName))
    const url = process.env.SIGNAL_SERVER + '/signal/sendImageTogroup'
    const result = await axios.post(url, formData, { headers: formData.getHeaders() })
    return result.data
  },

  // hack to get signal to initialize a group. Once created, add the groupId to 
  newGroup: async (groupName) => {
    try {
      const options = {
        groupName: groupName
      }
      const resp = await axios.post(process.env.SIGNAL_SERVER + '/signal/createGroup', options)
      return resp.data
    } catch (error) {
      console.log(error)
      console.log('couldnt send a message to signal bot')
    }
  },
}

const encodePlus = (string) => {
  let e164 = string
  if (string.includes('+')) {
    e164 = string.replace('+', '%2B')
  }
  return e164;
}

// ;( async () => {
//   const env = require('node-env-file')
//   env(__dirname + '/../.env')
//   await module.exports.newGroup()
//   process.exit()  
// })()