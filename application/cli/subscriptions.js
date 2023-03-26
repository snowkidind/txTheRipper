// example sub 0xc47aaa860008be6f65b58c6c6e02a84e666efe31

const fs = require('fs')
const { getAnswer } = require('./common.js')
const { dbProfiles, dbSubscriptions } = require('../../db')

//  const { log, logError } = require('../../utils/log')

let profile, profiles, rl

module.exports = {

  mainMenu: async (_rl) => {

    if (!rl) {
      rl = _rl
    }

    const mainMenu = module.exports.mainMenu

    const createProfile = async () => {
      const identifier = await getAnswer(rl, 'identifier, e.g. \'AccountSniffer\'', mainMenu)
      await dbProfiles.new(identifier, 'enabled')
      profiles = await dbProfiles.all()
      profile = undefined
    }

    const subscriptionSelector = async (profileId) => {
      let subs = await dbSubscriptions.get(profileId)
      subs.forEach((s) => {
        console.log(String(s.id + ':').padEnd(5) + s.routeHandler.padEnd(25) + s.reference.padEnd(44) + s.deliveryMethod.padEnd(15) + ' enabled: ' + s.enabled)
      })
      const _sub = await getAnswer(rl, '\n  Select a subscription (id)', mainMenu)
      let selection
      subs.forEach((s) => {
        if (s.id === Number(_sub)) selection = s
      })
      return selection
    }

    if (typeof profile === 'undefined') {
      console.log("\n  ####### Subscription Config: #######\n")
      console.log('  A profile allows you to create subscriptions to events triggered via the indexer.')
      console.log('  To use this config tool, you must select a profile to attach subscriptions to:\n')
      profiles = await dbProfiles.all()
      if (profiles.length === 0) {
        console.log('No Profiles found. Create one:')
        await createProfile()
      }
      profiles = profiles.sort((a, b) => { return a.id > b.id? 1 : -1 })
      profiles.forEach((p, index) => {
        const count = index + 1
        console.log('  ' + count + ': profileId: ' + p.id + ' status: ' + p.status + ' identifier: ' + p.identifier)
      })
      const _profile = await getAnswer(rl, '\n  Select a profile (numeric)', mainMenu)
      profile = profiles[_profile - 1]
      if (typeof profile === 'undefined') {
        await mainMenu()
        return
      }
    }

    let menu = "\n  ####### Subscription Config Menu: #######\n\n"
    menu += "       Modifying Profile for: \"" + profile.identifier + "\" restart to change selection\n"
    menu += "  n    Create new profile\n"
    menu += "  p    show profile\n"
    menu += "  s    Get Subscriptions\n"
    menu += "  +    Add Subscription\n"
    menu += "  -    Remove Subscription\n"
    menu += "  d    Disable Subscription\n"
    menu += "  e    Enable Subscription\n"
    menu += "  q    Exit\n\n"
    menu += "  Enter a command:\n "
    const answer = await getAnswer(rl, menu, mainMenu)
    const args = answer.split(' ')
    const query = args[0]

    const deliveryMethods = ['', 'unix_socket', 'redis_mem']

    if (query === 'n') {
      await createProfile()
    }

    else if (query === 'p') {
      console.log(profile)
    }

    else if (query === "s") {
      const subs = await dbSubscriptions.get(profile.id)
      subs.forEach((s) => {
        console.log(s)
      })
    }

    else if (query === "+") {
      const account = await getAnswer(rl, 'Account to add: (EOA/address)', mainMenu)
      const deliveryMethod = await getAnswer(rl, 'delivery method: 1. unix_socket, 2. redis_mem', mainMenu)
      await dbSubscriptions.add(profile.id, 'accounts', account, { type: 'all' }, deliveryMethods[deliveryMethod])
    }

    else if (query === "-") {
      const account = await getAnswer(rl, 'Account to remove:', mainMenu)
      const deliveryMethod = await getAnswer(rl, 'delivery method: 1. unix_socket, 2. redis_mem', mainMenu)
      const status = await dbSubscriptions.drop(profile.id, account, deliveryMethods[deliveryMethod])
      console.log('Dropped:' + status)
    }

    else if (query === 'd') {

      const sub = await subscriptionSelector(profile.id)
      if (sub) {
        const enabled = await dbSubscriptions.disable(sub.id)
        console.log('Set enabled = ' + enabled)
      }
    }

    else if (query === 'e') {
      const sub = await subscriptionSelector(profile.id)
      if (sub) {
        const enabled = await dbSubscriptions.enable(sub.id)
        console.log('Set enabled = ' + enabled)
      }
    }

    else if (query === "q" || query === "x") {
      console.log("Exit Application from Cli", 1)
      rl.close()
      process.exit()
    }
    mainMenu()
  }
}