const fs = require('fs-extra')
const nodeFs = require('fs')
const path = require('path')
const Git = require('nodegit')
const readlineSync = require('readline-sync')
const hash = require('string-hash')
const os = require('os')
const CliProgress = require('cli-progress')
const COMMIT_MSG_PREFIX = 'git-slice:'

let _username = null
let _password = null

const progressBar = new CliProgress.Bar(
  {
    format: '{bar} {percentage}% | ETA: {eta_formatted} | {value}/{total}'
  },
  CliProgress.Presets.shades_classic
)

async function getAllFiles(dir) {
  try {
    let results = []
    const list = await fs.readdir(dir)
    if (!list.length) return results
    for (let file of list) {
      file = path.resolve(dir, file)
      const stat = await fs.stat(file)
      if (stat && stat.isDirectory()) {
        results = results.concat(await getAllFiles(file))
      } else {
        results.push(file)
      }
    }
    return results
  } catch (e) {
    console.log(e)
    return []
  }
}

async function getCurBranch(repo) {
  return (await repo.getCurrentBranch()).name().replace('refs/heads/', '')
}

function addCommmitMsgPrefix(msg) {
  return COMMIT_MSG_PREFIX + msg
}

function removeCommitMsgPrefix(msg) {
  return msg.replace(COMMIT_MSG_PREFIX, '')
}

function ensureArray(input) {
  if (!input) {
    return []
  } else {
    return Array.isArray(input) ? input : [input]
  }
}

async function getLastGitSliceCommitHash(repo) {
  const revwalk = Git.Revwalk.create(repo)
  revwalk.pushHead()
  const commits = await revwalk.getCommitsUntil(c => true)
  const commit = commits
    .find(x => x.message().indexOf(COMMIT_MSG_PREFIX) === 0)
    .message()
  return commit.replace(COMMIT_MSG_PREFIX, '')
}

async function promptForCredentials(url, existingUserName) {
  if (!_username || !_password) {
    console.log(_username, _password)
    progressBar.stop()
    console.log(`Credentials required to access ${url}`)
    _username = readlineSync.question('Username: ')
    _password = readlineSync.question('Password: ', {
      hideEchoBack: true
    })
  }
  return Git.Cred.userpassPlaintextNew(_username, _password)
}

function transferProgress(stats) {
  if (stats.receivedObjects() === 0) {
    progressBar.start(stats.totalObjects(), stats.receivedObjects())
  }
  progressBar.setTotal(stats.totalObjects())
  progressBar.update(stats.receivedObjects())
}

async function cloneRepo(mainUrl, mainRepoPath, branch) {
  try {
    await fs.remove(mainRepoPath)
    await Git.Clone.clone(mainUrl, mainRepoPath, {
      checkoutBranch: branch,
      fetchOpts: {
        callbacks: {
          certificateCheck: function() {
            return 1
          },
          credentials: promptForCredentials,
          transferProgress
        }
      }
    })
    progressBar.stop()
  } catch (ex) {
    progressBar.stop()
    console.log(`Unable to clone ${mainUrl}: `, ex)
    throw ex
  }
}

async function updateFromOrigin(mainUrl, repo, branch) {
  console.log('Pulling', mainUrl)
  try {
    await repo.fetch('origin', {
      callbacks: {
        credentials: promptForCredentials,
        transferProgress
      }
    })
    progressBar.stop()
    await repo.mergeBranches(branch, `origin/${branch}`)
  } catch (e) {
    progressBar.stop()
    console.log(`Unable to update ${mainUrl}: `, ex)
    throw ex
  }
}


async function connectToRemote(repo, remote = 'origin') {
  const repoOrigin = await repo.getRemote(remote)

  await repoOrigin.connect(Git.Enums.DIRECTION.FETCH, {
    credentials: promptForCredentials,
    certificateCheck() {
      return 1
    }
  })

  return repoOrigin
}

async function headExistInRemote(repo, remote, head) {
  const origin = await connectToRemote(repo, remote)
  const references = await origin.referenceList()

  return references.filter(reference => reference.name() === head)[0]
}

async function mergeFromOrigin(repo, branchName) {
  try {
    const remoteBranch = await headExistInRemote(
      repo,
      'origin',
      `refs/heads/${branchName}`
    )

    if (!remoteBranch) return

    console.log(`Updating branch ${branchName} by pulling from origin`)
    await repo.mergeBranches(branchName, `origin/${branchName}`)
  } catch (error) {
    console.log(`Unable to update branch ${branchName}: `, error)
    throw error
  }
}

async function getTempRepo(mainUrl, branch, username, password) {
  if (username && password) {
    _username = username
    _password = password
  }
  const mainRepoPath = getTempRepoPath(mainUrl)
  try {
    // Git repo exists so lets just update it
    const repo = await Git.Repository.open(mainRepoPath)
    const origin = await repo.getRemote('origin')

    if (origin.url() === mainUrl) {
      await updateFromOrigin(origin.url(), repo, branch)
    } else {
      await cloneRepo(mainUrl, mainRepoPath, branch)
    }
  } catch (e) {
    // Git repo does not exits so lets clone it
    await cloneRepo(mainUrl, mainRepoPath, branch)
  }
  return mainRepoPath
}

function getTempRepoPath(url) {
  return path.join(os.tmpdir(), 'git-slice', hash(url).toString())
}

async function pushTempRepo(repoUrl, branch) {
  try {
    const mainRepoPath = getTempRepoPath(repoUrl)
    const repo = await Git.Repository.open(mainRepoPath)
    const origin = await repo.getRemote('origin')
    await origin.push([`+refs/heads/${branch}:refs/heads/${branch}`], {
      callbacks: {
        credentials: promptForCredentials,
        transferProgress
      }
    })
    progressBar.stop()
  } catch (e) {
    progressBar.stop()
    return Promise.reject(`Unable to push to ${repoUrl}: `, e.toString())
  }
}

async function copyFiles(source, destination, folders, ignored) {
  const symbolicLinks = []
  const repo = await Git.Repository.open(source)
  const ignoredFiles = ignored.map(f => path.resolve(source, f))
  for (let p of folders) {
    const allFiles = await getAllFiles(path.resolve(source, p))
    for (let sourceFile of allFiles) {
      const isGitIgnored = await Git.Ignore.pathIsIgnored(repo, sourceFile)
      if (!isGitIgnored && ignoredFiles.indexOf(sourceFile) === -1) {
        const stats = nodeFs.lstatSync(sourceFile)
        if (stats.isSymbolicLink()) {
          symbolicLinks.push(sourceFile)
        } else {
          const desFile = sourceFile.replace(source, destination)
          await fs.ensureFile(desFile)
          await fs.copy(sourceFile, desFile)
          nodeFs.chmodSync(
            desFile,
            (stats.mode & parseInt('777', 8)).toString(8)
          )
        }
      }
    }
  }
  for (let sourceFile of symbolicLinks) {
    const desFile = sourceFile.replace(source, destination)
    await fs.ensureDir(path.resolve(desFile, '../'))
    nodeFs.symlinkSync(nodeFs.readlinkSync(sourceFile), desFile)
  }
}

async function deleteFiles(source, ignored) {
  const repo = await Git.Repository.open(source)
  const ignoredFiles = ignored.map(f => path.resolve(source, f))
  for (let file of await getAllFiles(source)) {
    const isGitIgnored = await Git.Ignore.pathIsIgnored(repo, file)
    if (!isGitIgnored && ignoredFiles.indexOf(file) === -1) {
      await fs.remove(file)
    }
  }
}

function findFile(startPath, filter) {
  if (!fs.existsSync(startPath)) {
    console.log('This is not a directory', startPath)
    return
  }
  const output = []
  const files = fs.readdirSync(startPath)
  for (var i = 0; i < files.length; i++) {
    var filename = path.join(startPath, files[i])
    var stat = fs.lstatSync(filename)
    if (stat.isDirectory()) {
      output.push(...findFile(filename, filter)) //recurse
    } else if (filename.indexOf(filter) >= 0) {
      output.push(filename)
    }
  }
  return output
}

module.exports = {
  getAllFiles,
  getCurBranch,
  addCommmitMsgPrefix,
  removeCommitMsgPrefix,
  ensureArray,
  getLastGitSliceCommitHash,
  getTempRepo,
  copyFiles,
  deleteFiles,
  pushTempRepo,
  getTempRepoPath,
  findFile
}
