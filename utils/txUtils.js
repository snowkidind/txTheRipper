
module.exports = {

  // extract eth addresses from input data
  decodeInputData: (inputData, verifyAddr) => {
    const chunks = inputData.substr(10).match(/.{1,64}/g) ?? []
    const results = []
    chunks.forEach((c) => {
      if (!c.startsWith('000000000000000000000000')) return // remove bytes inputs
      const ss = c.substr(24)
      if (ss.startsWith('00000000000000')) return // remove anything with a ton of zeroes at the front
      if (ss.length !== 40) return // remove any anomalies
      if (verifyAddr) { // Job completed in 16.702022 ms
        const isAddr = ethers.utils.isAddress('0x' + ss)
        if (isAddr) results.push('0x' + ss)
      } else { // Job completed in 1.465776 ms
        results.push('0x' + ss)
      }
    })
    return results
  },

  // Given a bock tract, extract all addresses involved with said block
  extractTopicsFromInputData: (blockTrace) => {
    let newContracts = []
    let txnsPre = {}
    blockTrace.forEach((t) => { // prepopulate an object with transaction hashes
      if (!t.error && typeof t.transactionHash !== 'undefined') txnsPre[t.transactionHash] = []
      if (t.action.init && !t.error) {
        newContracts.push(t.result.address)
      } // annotate new contracts
    })
    blockTrace.forEach((t) => { // add related transactions to respective hash
      if (!t.error && typeof t.transactionHash !== 'undefined') txnsPre[t.transactionHash].push(t)
    })
    let txns = {}
    for (hash in txnsPre) { // iterate groups of txs
      const group = txnsPre[hash]
      let inputFound = false
      let topics = []
      group.forEach((item) => {
        if (!inputFound) { // only process inputs once
          if (item.action.input !== '0x' && typeof item.action.input !== 'undefined') {
            const inputTopics = module.exports.decodeInputData(item.action.input, false)
            if (inputTopics.length > 0) {
              topics = [...topics, ...inputTopics]
              inputFound = true
            }
          }
        }
        if (item.action.from) topics.push(item.action.from)
        if (item.action.to) topics.push(item.action.to)
        if (item.action.init && !item.error) {
          if (item.result.address) topics.push(item.result.address) // add newly generated contract addrs
        }
      })
      txns[hash] = new Set(topics)
    }
    return [txns, newContracts, txnsPre]
  }
}