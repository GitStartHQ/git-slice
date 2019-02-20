const Git = require('nodegit')
const path = require('path')
const fs = require('fs-extra')
const {
  addCommmitMsgPrefix,
  getTempRepo,
  copyFiles,
  deleteFiles
} = require('../utils')
const { CONFIG_FILENAME } = require('../constants')

async function updateFolderFromMain(currentDir, username, password) {
  try {
    const config = await fs.readJson(path.resolve(currentDir, CONFIG_FILENAME))

    const tempRepoParams = {
      mainUrl: config.repoUrl,
      branch: config.branch,
      username,
      password,
      testSuite: 'pull'
    }
    const mainRepoPath = await getTempRepo(tempRepoParams)
    const mainRepo = await Git.Repository.open(mainRepoPath)
    await mainRepo.checkoutBranch(config.branch)
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
      await index.write()
      const oid = await index.writeTree()
      const parent = await folderRepo.getCommit(
        await Git.Reference.nameToId(folderRepo, 'HEAD')
      )
      await folderRepo.createCommit(
        'HEAD',
        signature,
        signature,
        addCommmitMsgPrefix((await mainRepo.getHeadCommit()).sha()),
        oid,
        [parent]
      )
      console.log(`This repo is updated successfully`)
    } else {
      console.log(`This repo already up-to-date`)
    }
  } catch (e) {
    return Promise.reject(e)
  }
}

module.exports = updateFolderFromMain
