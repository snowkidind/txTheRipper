const ethers = require('ethers')
const pako = require('pako')
const fs = require('fs')

const testData = [
  { "block": 10800000, "timestamp": 1599290487, "hash": "0xf56a4e0d9215be9526bfe1c5eb8f85346396c4de87c490967b00182da9a57de4", "topics": ["0xed3f0e8793dd37c44b94d052e524b9e05560bf87", "0x27fba7319af11a98cccb99aaed703e243dcf6bc9"] },
  { "block": 10800000, "timestamp": 1599290487, "hash": "0xa0ef7c140dd4edf747b58d02ac5aa42513fc8fd67ff613483a2424ca56b6e3d4", "topics": ["0xd2d865c9d2960b53127c3bfca8a237bc7c803adc", "0xc4da39e646e7f5d233b89ca0f7b75344e7ddb2cc", "0x7a250d5630b4cf539739df2c5dacb4c659f2488d"] },
  { "block": 10800000, "timestamp": 1599290487, "hash": "0xf9fba9a4ed29d8dfc8895737e62f71957abcfb64f503864fc5f68230efa33abf", "topics": ["0x19ae14a6aeb13b2bf2307bf010a329831a1cfbfe", "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc"] },
  { "block": 10800000, "timestamp": 1599290487, "hash": "0x464865b975760c29897b9934b9b5a547e66f8e19bb27b8faaaafe71581c2ea24", "topics": ["0xa7efae728d2936e78bda97dc267687568dd593f3", "0xde8589960da34eefb00ca879d8cc12b11f52cb12"] },
  { "block": 10800000, "timestamp": 1599290487, "hash": "0x957da6e9dc61e6ab02974a8f7061caf129868a9a5cc70f56df71097b4a112049", "topics": ["0x461e2ec2b56e803e49e4701c83a45f216a73fd50", "0x623806fa0b038ce00f56d9fc8d87fbfa6f5a85f3"] },
  { "block": 10800000, "timestamp": 1599290487, "hash": "0xb9ec5e8c1da7733e81df4263469d26a7ab1135604ea20bd79679963c9b47206d", "topics": ["0xe93381fb4c4f14bda253907b18fad305d799241a", "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e", "0x92120c10bc4f2d7b851f1bfabb0b18635f1dec10"] },
  { "block": 10800000, "timestamp": 1599290487, "hash": "0xe714a1a41bcb173653869f67d9397dfda291fdaabbd1a777bfe316458b4d62c9", "topics": ["0x46705dfff24256421a05d056c29e81bdc09723b8", "0xdac17f958d2ee523a2206206994597c13d831ec7", "0xdc83b9b24cf874f4245099e1d50f4b62f75298d9"] },
]

const jsonData = require(__dirname + '/derived/transactions/10000000/100000/10100135.json')

const data = jsonData

// delimiters to separate the objects
const newRecord = pako.deflate('+')
const newRecordStr = newRecord.toString()
const delimiter = pako.deflate('_')
const delimit = delimiter.toString()

const scrunchObjIntoBinary = (obj) => {
  const blockBin = pako.deflate(longToByteArray(obj.block))
  const timestampBin = pako.deflate(longToByteArray(obj.timestamp))
  const hashBin = pako.deflate(ethers.utils.arrayify(obj.hash))
  let topicsBins = []
  obj.topics.forEach((topic) => { 
    topicsBins = [...topicsBins, ...pako.deflate(ethers.utils.arrayify(topic))]
  })
  const bin = [...blockBin, ...delimiter, ...timestampBin, ...delimiter, ...hashBin, ...delimiter, ...topicsBins]   
  const lengthId = [...newRecord, ...pako.deflate(ethers.utils.arrayify(bin.length)), ...delimiter]
  return [...lengthId, ...bin]
}

// Given a binary object, convert it into a useable JSON object
const extractObjsFromBinary = (bin) => {

  let extracted = []

  // First convert the binary into a string and separate the records by splitting on the newRecord delimiter
  const array = new Uint8Array(bin)
  const convert = array.toString()
  const datum = convert.split(newRecordStr)
  for (let i = 0; i < datum.length; i++) {
    if (datum[i].length === 0) continue

    // Iterating each record, further split by second delimiter and iterate
    const objs = datum[i].substring(1).split(delimit)
    let item = { // template return object
      block: undefined,
      timestamp: undefined,
      hash: undefined,
      topics: []
    }
    for (let j = 0; j < objs.length; j++) {

      // there are some artifacts from all the splitting, treat accordingly
      const arr = objs[j].split(',') // split strings containing extra ,'s into array 
      const filtered = arr.filter((x) => { // remove any empty indexes
        return x !== ''
      })
      const value = new Uint16Array(filtered)

      // inflate the scrunched binary into one layer deep binary, then convert 
      // according to the data type, and collect for output
      const inflator = new pako.inflate(value)
      if (j === 1) {
        item.block = byteArrayToLong(inflator)
      }
      if (j === 2) {
        item.timestamp = byteArrayToLong(inflator)
      }
      if (j === 3) {
        item.hash = '0x' + buf2hex(inflator)
      }
      if (j === 4) {
        const addresString = buf2hex(inflator)
        for (let i = 0; i < addresString.length / 40; i++) {
          const start = i * 40
          const index = i * 40 + 40
          item.topics.push('0x' + addresString.slice(start, index))
        }
      }
    }
    extracted.push(item)
  }
  return extracted
} 

const byteArrayToLong = (byteArray) => {
  var value = 0;
  for (var i = byteArray.length - 1; i >= 0; i--) {
    value = (value * 256) + byteArray[i]
  }
  return value
}

const longToByteArray = (long) => {
  var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
  for (var index = 0; index < byteArray.length; index++) {
    var byte = long & 0xff;
    byteArray[index] = byte;
    long = (long - byte) / 256;
  }
  return new Uint8Array(byteArray)
}

function buf2hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}


  ; (async () => {
    try {
      let b = []
      console.log(data.length)
      
      for (let i = 0; i < data.length; i++) {
        b.push(...scrunchObjIntoBinary(data[i]))
      }
      
      const file = __dirname + '/testbinfile'
      new fs.writeFileSync(file, Buffer.from(b))

      // const bin = fs.readFileSync(file)
      // const extracted = extractObjsFromBinary(bin)
      console.log(extracted)
    } catch (error) {
      console.log(error)
    }
    process.exit()
  })()

