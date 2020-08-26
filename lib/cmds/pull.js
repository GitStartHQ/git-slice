const Git = require('nodegit')
const path = require('path')
const fs = require('fs-extra')
const {
  addCommmitMsgPrefix,
  getTempRepo,
  copyFiles,
  deleteFiles,
  findFile
} = require('../utils')
const { CONFIG_FILENAME } = require('../constants')
// const {
//   insertClientRepositoryCommit,
//   upsertDatabaseFromConfig
// } = require('../graphlql/mutations')
// const { getClientRepository, getClientCreds } = require('../graphlql/query')

// const { CIRCLE_REPOSITORY_URL } = process.env

async function updateFolderFromMain(currentDir, username, password) {
  try {
    const config = await fs.readJson(path.resolve(currentDir, CONFIG_FILENAME))
    // await upsertDatabaseFromConfig(config, CIRCLE_REPOSITORY_URL)
    // const clientRepoDetails = await getClientRepository(CIRCLE_REPOSITORY_URL)
    let clientRepoUrl = config.repoUrl
    let clientBaseBranchName = config.branch
    // if (!!clientRepoDetails) {
    //   clientRepoUrl = clientRepoDetails.clientRepoUrl || config.repo
    //   clientBaseBranchName =
    //     clientRepoDetails.clientBaseBranchName || config.branch
    // }
    // const creds = await getClientCreds(clientRepoUrl)
    // if (!!creds && creds.username && (creds.token || creds.password)) {
    //   username = creds.username
    //   password = !!creds.token ? creds.token : creds.password
    // }
    if (!clientRepoUrl.includes(`//${username}@`)) {
      clientRepoUrl = clientRepoUrl.replace('//', `//${username}@`)
    }
    const mainRepoPath = await getTempRepo(
      clientRepoUrl,
      clientBaseBranchName,
      username,
      password
    )

    const mainRepo = await Git.Repository.open(mainRepoPath)
    await mainRepo.checkoutBranch(clientBaseBranchName)
    const folderRepo = await Git.Repository.open(currentDir)
    if ((await folderRepo.getStatus()).length) {
      throw 'Error: cannot pull with uncommitted changes'
    }

    await folderRepo.checkoutBranch('master')
    await folderRepo.setHead(`refs/heads/master`)

    await deleteFiles(currentDir, config.ignore)
    await copyFiles(mainRepoPath, currentDir, config.folders, config.ignore)

    const repoStatus = await folderRepo.getStatus()
    if (repoStatus.length) {
      const signature = folderRepo.defaultSignature()
      let index = await folderRepo.refreshIndex()
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
      const keepFiles = findFile(currentDir, '.keep')
      for (let file of keepFiles)
        await index.addByPath(path.relative(currentDir, file))

      await index.write()
      const oid = await index.writeTree()
      const parent = await folderRepo.getCommit(
        await Git.Reference.nameToId(folderRepo, 'HEAD')
      )

      const clientBaseCommitSHA = (await mainRepo.getHeadCommit()).sha()
      await folderRepo.createCommit(
        'HEAD',
        signature,
        signature,
        addCommmitMsgPrefix(clientBaseCommitSHA),
        oid,
        [parent]
      )
      console.log(`This repo is updated successfully`)

      // const slicedCommitSHA = (await folderRepo.getHeadCommit()).sha()
      // if (!!clientRepoDetails && clientRepoDetails.id) {
      //   await insertClientRepositoryCommit({
      //     clientBaseCommitSHA,
      //     slicedCommitSHA,
      //     clientRepositoryId: clientRepoDetails.id
      //   })
      // }
    } else {
      console.log(`This repo already up-to-date`)
    }
  } catch (e) {
    return Promise.reject(e)
  }
}

module.exports = updateFolderFromMain
