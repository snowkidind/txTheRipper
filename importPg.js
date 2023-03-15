const { exec } = require('child_process')
const perf = require('execution-time')()
const env = require('node-env-file')
const { v4 } = require('uuid')
env(__dirname + '/.env')
const fs = require('fs')

const readline = require('node:readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

let addToDb = false
const schema = process.env.BASEPATH + 'schema.sql'
const schemaPost = process.env.BASEPATH + 'schema_post.sql'
const basesql = process.env.BASEPATH + 'derived/sql/'

const generateFiles = async () => {

  const add = await getAnswer('Add directly to db? (y)')
  if (add === 'y') {
    await addDb(schema)
    addToDb = true
  }

  // Since we are generating files from the beginning no sense in keeping any garbage previously in here
  // delete everything in the sql directory 
  console.log('Removing sql files in basesql dir')
  const dir = await fs.readdirSync(basesql)
  for (let i = 0; i < dir.length; i++) {
    fs.rmSync(basesql + dir[i])
  }

  // parentId - we use this to generate the links between the transactions and topic tables
  let parentId = 1
  const jsonData = __dirname + '/derived/transactions/'
  for (let i = 0; i < 17000000; i++) {
    try {
      parentId = await nextMillion(jsonData + i + '/', parentId)
      i += 999999
    } catch (error) {
      console.log(error)
      process.exit(1)
    }
  }
  console.log('Process Complete')
}

const sleep = (m) => { return new Promise(r => setTimeout(r, m)) }
const percent = (size, i) => { return Math.floor(i / size * 100) }

const getAnswer = (message) => {
  return new Promise((resolve) => {
    rl.question(message + '\n > ', async (answer) => {
      if (answer === 'c') {
        console.log('Operation Cancelled')
        process.exit()
        return
      }
      resolve(answer)
    })
  })
}

const addDb = (fileToRead) => {
  return new Promise((resolve, reject) => {
    exec("psql -d ripper -f " + fileToRead, (error, stdout, stderr) => {
      if (error) {
        console.log(error.message)
        reject()
      }
      if (stderr) {
        console.log(stderr)
        reject()
      }
      console.log(stdout.replace(/\n*$/, ""))
      resolve()
    })
  })
}


const nextMillion = async (rangeData, startId) => {
  console.log('Starting next million with id: ' + startId)
  let id = startId // because the indexing cannot use uniqueness we generate our own id string
  const dir = fs.readdirSync(rangeData)
  for (let i = 0; i < dir.length; i++) {
    const innerDirPath = rangeData + dir[i]
    const innerDir = fs.readdirSync(innerDirPath)
    for (let j = 0; j < innerDir.length; j++) {
      const innerDirFile = innerDirPath + '/' + innerDir[j]
      if (innerDirFile.includes('.json')) {
        const timer = v4()
        perf.start(timer)
        console.log('Reading: ' + innerDirFile)
        const _json = fs.readFileSync(innerDirFile)
        const json = JSON.parse(_json)
        // read current index of both tables because we will be doing the ids
        let f1 = 'INSERT INTO transactions ("id", "block", "timestamp", "hash") VALUES \n'
        let f2 = 'INSERT INTO topic ("parent", "account") VALUES \n'
        for (let k = 0; k < json.length; k++) {
          const data = json[k]
          f1 += '(' + id + ',' + data.block + ',' + data.timestamp + ',\'' + data.hash + '\'),\n'
          for (let l = 0; l < data.topics.length; l++) {
            f2 += '(' + id + ',\'' + data.topics[l] + '\'),\n'
          }
          id += 1
        }
        const sqlFile = innerDir[j].replace('.json', '.sql')
        console.log('writing to file: ' + sqlFile)
        const file = 'BEGIN;\n' + f1.substring(0, f1.length - 2) + ';\n\n' + f2.substring(0, f2.length - 2) + ';\nCOMMIT;\n'
        fs.writeFileSync(basesql + sqlFile, file)
        const nvmeTime = perf.stop(timer)
        console.log('ETL processed in ' + nvmeTime.preciseWords + ' resting 1s')
        delete json
        await sleep(1000)
        const used = process.memoryUsage()
        for (let key in used) {
          const item = Math.round(used[key] / 1024 / 1024 * 100) / 100
          console.log(String(key).padEnd(15) + item + ' MB');
        }
      }
    }
  }
  return id
}

const sortDir = (dir) => {
  let unsortedDirInts = []
  dir.forEach((f) => {
    if (f.includes('.sql')) {
      unsortedDirInts.push(Number(f.replace('.sql', '')))
    }
  })
  const sortedDir = unsortedDirInts.sort((a, b) => { return a > b ? 1 : -1 })
  return sortedDir.map((n) => { return String(n) + '.sql' })
}


const insertSql = async () => {
  const main = v4()
  perf.start(main)
  const add = await getAnswer('Nuke existing tables and add data to db? (y)')
  if (add === 'y') {
    await addDb(schema)
  } else {
    console.log('Operation Canceled.')
    process.exit(0)
  }

  const keep = true
  const _keep = await getAnswer('Keep or Delete intermdiate SQL files? (k - default, d)')
  if (_keep === 'd') {
    console.log('Notice, deleting intermdiate SQL files.')
    keep = false
  }

  const _dir = await fs.readdirSync(basesql)
  const dir = sortDir(_dir)
  const doneDir = basesql + 'done/'
  for (let i = 0; i < dir.length; i++) {
    const timer = v4()
    perf.start(timer)
    console.log('Importing file: ' + dir[i])
    try {
      await addDb(basesql + dir[i])
    } catch (error) {
      // This will stop you at the last good inserted file and exit if the db had an issue with current one.
      console.log(error)
      console.log('Notice: Couldn\'t insert file into database. exiting.')
      console.log('The problem was at file: ' + basesql + dir[i])
      process.exit()
    }
    if (keep === true) {
      await fs.renameSync(basesql + dir[i], doneDir + dir[i]) // mv to done folder once completed
    } else {
      await fs.rmSync(basesql + dir[i])
    }
    const nvmeTime = perf.stop(timer)
    console.log('Import processed in ' + nvmeTime.preciseWords)
    await sleep(1000)
  }
  
  console.log('Adding indexes, this could take several hours. To observe, watch PG e.g. $ du -h pg_tablespace')
  const index = v4()
  perf.start(index)
  await addDb(schemaPost)
  const indexTime = perf.stop(index)
  console.log('Index performed in ' + indexTime.preciseWords)
  
  const mainTime = perf.stop(main)
  console.log('Operation Completed in ' + mainTime.preciseWords)
}

  ; (async () => {
    try {
      let menu = '################# txRipper #################\n'
      menu += '  this tool generates and inserts sql transaction files into the database\n'
      menu += '  to use less resources first generate the files without inserting and then\n'
      menu += '  insert them by running the program a second time...\n\n'
      menu += '  g     Generate sql files\n'
      menu += '  i     Insert generated sql files\n'
      const answer = await getAnswer(menu)
      if (answer === 'g') {
        await generateFiles()
      } else if (answer === 'i') {
        await insertSql()
      }
    } catch (error) {
      console.log(error)
    }
    process.exit()
  })()