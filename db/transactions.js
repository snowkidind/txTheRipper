const fs = require('fs')
const basepath = process.env.BASEPATH + 'derived/transactions/'
// const perf = require('execution-time')()
// const { v4 } = require('uuid')

let txQueue = []
const fileSizeMax = 300000000 // 400000000 (max for json)
let commitFile

module.exports = {

  syncHeight: async () => {
    const syncFile = basepath + 'syncHeight'
    if (!fs.existsSync(syncFile)) {
      console.log('Initializing Tx Height file...')
      fs.writeFileSync(syncFile, String(0))
    }
    const height = Number(fs.readFileSync(syncFile))
    return height
  },

  updateSyncHeight: async (block) => {
    const syncFile = basepath + 'syncHeight'
    if (!fs.existsSync(syncFile)) {
      console.log('Initializing Tx Height file...')
      fs.writeFileSync(syncFile, String(block))
    } else {
      fs.writeFileSync(syncFile, String(block))
    }
  },

  addTransaction: async (block, timestamp, hash, topics) => {
    txQueue.push({
      block: block,
      timestamp: timestamp,
      hash: hash,
      topics: setToArray(topics)
    })
  },

  // this behaves like a force commit when called externally
  commitTxSync: async (block) => {
    if (!commitFile) {
      await estabishCommitFile(block)
    }
    await commitSync(block)
  },

  searchAddress: async (address, afterBlock) => {

  },

  queueSize: () => {
    return JSON.stringify(txQueue).length
  },

  highBlockForTask: async (mill, hth) => {
    try {
      const hthDir = basepath + mill + '/' + hth
      const dir = fs.readdirSync(hthDir)
      let fileIds = []
      dir.forEach((file) => {
        if (file.includes('.json')) {
          fileIds.push(Number(file.split('.json')[0]))
        }
      })
      fileIds = fileIds.sort((a, b) => { return a > b ? 1 : -1 }) // could be backwards who knows
      const highFile = basepath + mill + '/' + hth + '/' + fileIds[fileIds.length - 1] + '.json'
      const _json = fs.readFileSync(highFile, 'utf8')
      const json = JSON.parse(_json)
      const last = json[json.length - 1]
      return last.block
    } catch (error){
      console.log(error)
      return -1
    }
  },

  markTask: async (status, mill, hth) => {
    const hthDir = basepath + mill + '/' + hth + '/sync'
    fs.writeFileSync(hthDir, status)
  }
}

const parentStructure = (block) => {
  const mill = Math.floor(block / 1000000) * 1000000 // this will be 0 for under 1M, 3000000 etc for others
  const hth = Math.floor((block - mill) / 100000) * 100000
  return [mill, hth]
}

const setupDirForBlock = async (block) => {
  const [mill, hth] = parentStructure(block)
  const millDir = basepath + mill
  const hthDir = basepath + mill + '/' + hth
  if (!fs.existsSync(millDir)) {
    fs.mkdirSync(millDir)
  }
  if (!fs.existsSync(hthDir)) {
    fs.mkdirSync(hthDir)
  }
}

const readDirForBlock = async (block) => {
  const [mill, hth] = parentStructure(block)
  const hthDir = basepath + mill + '/' + hth
  const dir = fs.readdirSync(hthDir)
  let files = []
  dir.forEach((file) => {
    if (file.includes('.json')) {
      files.push(file)
    }
  })
  return files
}


const estabishCommitFile = async (block) => {

  // ensure dir structure exists and collect files in dir
  setupDirForBlock(block)
  let dir = await readDirForBlock(block)

  // select the appropriate path
  const [mill, hth] = parentStructure(block)

  // dir may / will have multiple files we want the one with the highest block

  // if no files exist, create new based on the block
  if (dir.length === 0) {
    fs.writeFileSync(basepath + mill + '/' + hth + '/' + block + '.json', '[]') // initialize new commit file
    commitFile = basepath + mill + '/' + hth + '/' + block + '.json'
  } else {
    
    // Select the file with the highest block index
    const files = []
    dir.forEach((item) => {
      files.push(Number(item.replace('.json', '')))
    })
    let highFile = 0
    files.forEach((f) => {
      if (f > highFile) {
        highFile = f
      }
    })

    commitFile = basepath + mill + '/' + hth + '/' + highFile + '.json'
    const stats = await fs.statSync(commitFile)
    if (stats.size > fileSizeMax) { 
      // needs a new commit file created
      fs.writeFileSync(basepath + mill + '/' + hth + '/' + block + '.json', '[]') // initialize new commit file
      commitFile = basepath + mill + '/' + hth + '/' + block + '.json'
      console.log('created new commit file: ' + commitFile)
    }
  }
}

const commitSync = async (block) => {

  const stats = await fs.statSync(commitFile)
  if (stats.size > fileSizeMax) {
    // needs new commit file
    await estabishCommitFile(block)
  }
  const dbRaw = await fs.readFileSync(commitFile)
  const db = JSON.parse(dbRaw)
  const newDb = [...db, ...txQueue]
  await fs.writeFileSync(commitFile, stringify(newDb))
  txQueue = []
}

const setToArray = (set) => {
  const arr = []
  set.forEach((item) => {
    arr.push(item)
  })
  return arr
}

const stringify = (obj) => {
  if (obj.length === 0) {
    return '[]'
  } else {
    let acc = '[\n'
    obj.forEach((obj) => { acc += '  ' + JSON.stringify(obj) + ',\n' })
    acc = acc.slice(0, acc.length - 2)
    acc += '\n]'
    return acc
  }
}
