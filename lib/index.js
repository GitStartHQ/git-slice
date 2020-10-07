require('dotenv').config()
const minimist = require('minimist')
const path = require('path')
const initializeFolder = require('./cmds/init')
const updateFolderFromMain = require('./cmds/pull')
const updateMainFromFolder = require('./cmds/push')
const modifyIgnoredFiles = require('./cmds/ignore')
const showHelp = require('./help')
const { INVALID_ARG_MSG } = require('./constants')
const { ensureArray } = require('./utils')

async function parseArgsAndExecute(currentDir, inputArgs) {
  try {
    const argv = minimist(inputArgs, { boolean: ['force-push'] })
    const { _: [command, ...args], help } = argv
    if (help) {
      showHelp(command)
      return
    }

    switch (command) {
      case 'init':
        if (argv.repo && argv.folder && args.length) {
          const forkedRepo = args[0]
          const folders = ensureArray(argv.folder)
          const branchName = argv.branch || 'master'
          console.log(`Initializing ${forkedRepo} from ${argv.repo}`)
          await initializeFolder(
            argv.repo,
            folders,
            path.resolve(currentDir, forkedRepo),
            branchName
          )
          console.log(`Successfully forked into ${forkedRepo}`)
        } else {
          console.log(INVALID_ARG_MSG)
          showHelp(command)
        }
        break
      case 'pull':
        await updateFolderFromMain(
          currentDir,
          argv['username'],
          argv['password']
        )
        break
      case 'push':
        const {
          branch,
          message,
          'author-name': authorName,
          'author-email': authorEmail,
          password,
          ...otherArgs
        } = argv
        if (branch && message && authorName && authorEmail) {
          await updateMainFromFolder(
            currentDir,
            branch,
            message,
            authorName,
            authorEmail,
            password,
            otherArgs
          )
        } else {
          console.log(INVALID_ARG_MSG)
          showHelp(command)
        }
        break
      case 'ignore':
        if (argv.add || argv.remove) {
          const filesToAdd = ensureArray(argv.add)
          const filesToRemove = ensureArray(argv.remove)
          await modifyIgnoredFiles(currentDir, filesToAdd, filesToRemove)
        } else {
          console.log(INVALID_ARG_MSG)
          showHelp(command)
        }
        break
      default:
        showHelp()
    }
  } catch (e) {
    console.log(e)
    console.log(e.stack)
    process.exit(1)
  }
}

module.exports = parseArgsAndExecute
