const Git = require('nodegit')
const path = require('path')
const fs = require('fs-extra')
// const { getClientCommitMessage } = require('../graphlql/query')
const {
  getAllFiles,
  getCurBranch,
  getLastGitSliceCommitHash,
  getTempRepo,
  copyFiles,
  pushTempRepo,
  findFile
} = require('../utils')
const { CONFIG_FILENAME } = require('../constants')

const { CIRCLE_PULL_REQUEST } = process.env

async function updateMainFromFolder(
  currentDir,
  branchName,
  commitMsg,
  authorName,
  authorEmail,
  password
) {
  try {
    const config = await fs.readJson(path.resolve(currentDir, CONFIG_FILENAME))

    // const clientCommitMessageData = await getClientCommitMessage(
    //   CIRCLE_PULL_REQUEST
    // )

    let clientRepoUrl = config.repoUrl
    let clientBaseBranchName = config.branch

    // const clientCommitMessage =
    //   clientCommitMessageData && clientCommitMessageData.clientCommitMessage
    //     ? clientCommitMessageData.clientCommitMessage
    //     : 'implementation'

    const mainRepoPath = await getTempRepo(
      clientRepoUrl,
      clientBaseBranchName,
      authorName,
      password
    )
    const mainRepo = await Git.Repository.open(mainRepoPath)
    await mainRepo.checkoutBranch(clientBaseBranchName)
    const folderRepo = await Git.Repository.open(currentDir)
    const curBranchName = await getCurBranch(folderRepo)
    console.log(curBranchName, '===whats current branch name')

    console.log(await Git.Repository.open(currentDir), '===folderRepo')
    console.log(folderRepo, '===folderRepo')
    console.log(mainRepo, '===mainRepo')

    if ((await folderRepo.getStatus()).length) {
      throw 'Error: cannot push with uncommitted changes'
    }
    console.log(
      'list all branch nanes',
      await mainRepo.getReferenceNames(Git.Reference.TYPE.LISTALL)
    )
    if (curBranchName === 'master') {
      throw 'Error: cannot push from master branch'
    }

    if (
      (await mainRepo.getReferenceNames(Git.Reference.TYPE.LISTALL)).indexOf(
        `refs/heads/${branchName}`
      ) === -1
    ) {
      await folderRepo.checkoutBranch('master')
      console.log('after checkout master ===+++')
      const commitHash = await getLastGitSliceCommitHash(folderRepo)
      console.log(commitHash, 'getLastGitSliceCommitHash===')
      await folderRepo.checkoutBranch(curBranchName)
      console.log('after checkout branch-==+++')
      console.log('commit sha===', commitHash)
      await mainRepo.createBranch(
        branchName,
        commitHash,
        0 // gives error if the branch already exists
      )
    } else {
      console.log('Branch already exists')
    }
    await mainRepo.checkoutBranch(branchName)
    await mainRepo.setHead(`refs/heads/${branchName}`)

    for (let p of config.folders) {
      for (let file of await getAllFiles(path.resolve(mainRepoPath, p))) {
        if (
          !await Git.Ignore.pathIsIgnored(mainRepo, file) &&
          config.ignore.indexOf(path.relative(mainRepoPath, file)) === -1
        ) {
          await fs.remove(file)
        }
      }
    }

    await copyFiles(currentDir, mainRepoPath, config.folders, config.ignore)

    const repoStatus = await mainRepo.getStatus()
    if (repoStatus.length) {
      const signature = Git.Signature.now(authorName, authorEmail)
      let index = await mainRepo.refreshIndex()
      for (let deletedFilePath of repoStatus
        .filter(file => file.isDeleted())
        .map(file => file.path())) {
        await index.remove(deletedFilePath, 0)
      }
      for (let addOrModifiedFilePath of repoStatus
        .filter(file => !file.isDeleted())
        .map(file => file.path())) {
        await index.addByPath(addOrModifiedFilePath)
      }

      const keepFiles = findFile(mainRepoPath, '.keep')
      for (let file of keepFiles)
        await index.addByPath(path.relative(mainRepoPath, file))

      await index.write()
      const oid = await index.writeTree()
      const parent = await mainRepo.getCommit(
        await Git.Reference.nameToId(mainRepo, 'HEAD')
      )
      await mainRepo.createCommit(
        'HEAD',
        signature,
        signature,
        commitMsg || 'implementation',
        oid,
        [parent]
      )

      await pushTempRepo(clientRepoUrl, branchName)

      console.log(`${clientRepoUrl} is updated`)
    } else {
      await pushTempRepo(clientRepoUrl, branchName)
      console.log(`${clientRepoUrl} already up-to-date`)
    }
  } catch (e) {
    return Promise.reject(e)
  }
}

module.exports = updateMainFromFolder
