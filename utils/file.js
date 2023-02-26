const fs = require('fs');

module.exports = {

  fileExists: (file) => {
    return fs.existsSync(file);
  },

  readFile: async function (file) {
    try {
      return fs.readFileSync(file, 'utf8')
    } catch (error) {
      if (error.errno === -2) {
        console.log('\nError: File not found.')
      } else {
        console.log(error)
      }
    }
  },

  writeFile: async function (file, content) {
    try {
      const response = await fs.writeFileSync(file, content);
      return response
    } catch (error) {
      console.log(error)
    }
  },

  deleteFile: async function (file) {
    return fs.rmSync(file);
  },

  appendFile: function (file, content) {
    if (fs.existsSync) {
      return fs.appendFileSync(file, content);
    } else {
      return fs.writeFileSync(file, content);
    }
  },

  makeDir: async function (dir) {
    return fs.mkdirSync(dir);
  },

  readDir: async function (dir) {
    try {
      return fs.readdirSync(dir);
    } catch (error) {
      console.log('File not found:' + dir)
    }
  },

  rmDirRf: async function (dir) {
    return fs.rmSync(dir, { recursive: true, force: true });
  },

  /*
 * This fails if it is an attempt to overwrite another existing file
 */
  copyFile: async function (source, dest) {
    fs.copyFileSync(source, dest, fs.constants.COPYFILE_EXCL);
  },

  processCsv: function (fileData) {
    const objects = [];
    const arr = fileData.split("\n");
    arr.forEach((line) => {
      let lineClean = line.replace(" ", "");
      if (lineClean !== '') {
        let info = lineClean.split(',');
        objects.push(info);
      }
    });
    return objects;
  }

};


