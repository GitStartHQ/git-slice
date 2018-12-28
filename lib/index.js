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
    const argv = minimist(inputArgs)
    const { _: [command, ...args], help } = argv
    if (help) {
      showHelp(command)
      return
    }
    console.log('command ?? ', command)
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
        console.log('?????')
        await updateFolderFromMain(
          currentDir,
          argv['username'],
          argv['password']
        )
        break
      case 'push':
        if (
          argv.branch &&
          argv.message &&
          argv['author-name'] &&
          argv['author-email']
        ) {
          await updateMainFromFolder(
            currentDir,
            argv.branch,
            argv.message,
            argv['author-name'],
            argv['author-email'],
            argv['password']
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
          console.log('make it here')
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
  }
}

module.exports = parseArgsAndExecute
