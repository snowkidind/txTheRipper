
const fs = require('fs')
const basepath = process.env.BASEPATH + '/derived/addresses/'
const perf = require('execution-time')()
const { v4 } = require('uuid')

let addrDb
let queued = []
let highIndex = -1

module.exports = {
  getAddressInfo: async (address, addWhenNotFound, block = 0) => {
    if (!addrDb) {
      await readDb()
    }
    const info = addrInfo(address)
    if (typeof info !== 'undefined') return info
    if (addWhenNotFound) {
      const info = await module.exports.addAddress(address, block)
      return info
    }
  },

  addAddress: async (address, block, name = '') => {
    if (!addrDb) {
      await readDb()
    }
    let info = addrInfo(address)
    if (typeof info !== 'undefined') return info
    info = await addAddr(address, block, name)
    return info
  },

  // Write entire addrDb to file
  commitAddr: async (block) => {
    const commitDb = v4()
    perf.start(commitDb)

    if (queued.length > 0) {
      const dataFile = [...addrDb, ...queued]
      console.log('commit: ' + queued.length + ' items at block: ' + block + ' totalling ' + dataFile.length + ' items')
      fs.writeFileSync(basepath + 'data0.json', stringify(dataFile))
      queued = []
      await readDb()
    } else {
      console.log('Skipping commit of block ' + block + ' because its already consumed')
    }

    if (highIndex === -1) highIndex = Number(fs.readFileSync(basepath + 'addrIndex'))
    fs.writeFileSync(basepath + 'addrIndex', String(highIndex)) // write new index to the file
    highIndex = -1 // trigger a read file

    const allDuration = perf.stop(commitDb)
    console.log('commitDb: ' + allDuration.preciseWords)
  }
}

const addAddr = async (address, block, name) => {
  const addrIndex = await incrementHighIndex()
  const info = {
    index: addrIndex, // the actual index is stored in a separate file in order to enforce synchronicity
    address: address,
    name: name,
    block: block
  }
  queued.push(info)
  return info
}

const addrInfo = (address) => {
  // const aInfo = v4()
  // perf.start(aInfo)

  for (let i = 0, len = addrDb.length; i < len; i++) {
    if (address === addrDb[i].address) {
      return addrDb[i]
    }
  }
  // if its already queued return info from the queue
  for (let i = 0, len = queued.length; i < len; i++) {
    if (address === queued[i].address) {
      return queued[i]
    }
  }

  // const allDuration = perf.stop(aInfo)
  // console.log('addrInfo ' + allDuration.preciseWords)
}


// Since we are JSON this will be stored as a db file across multiple files
const readDb = async () => {
  const readDb = v4()
  perf.start(readDb)

  addrDb = []
  const dir = fs.readdirSync(basepath)
  for (let i = 0; i < dir.length; i++) {
    if (dir[i].includes('data')){
      const thisFile = JSON.parse(fs.readFileSync(basepath + dir[i]))
      addrDb.push(...thisFile)
    }
  }
  if (typeof addrDb === 'undefined') {
    fs.writeFileSync(basepath + 'data0.json', JSON.stringify([]))
  }

  const allDuration = perf.stop(readDb)
  console.log('readDb: ' + allDuration.preciseWords)
}

const incrementHighIndex = async () => {

  if (!fs.existsSync(basepath + 'addrIndex')) {
    console.log('Initializing High Index file...')
    fs.writeFileSync(basepath + 'addrIndex', String(0))
    highIndex = -1
  }
  
  if (highIndex === -1 || !highIndex) {
    highIndex = Number(fs.readFileSync(basepath + 'addrIndex'))
  }

  highIndex += 1
  return highIndex
}

const stringify = (obj) => {  
  let acc = '[\n'
  obj.forEach((obj) => { acc += '  ' + JSON.stringify(obj) + ',\n' })
  acc = acc.slice(0, acc.length -2)
  acc += '\n]'
  return acc
}

