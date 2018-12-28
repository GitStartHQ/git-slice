const Git = require('nodegit')
const path = require('path')
const fs = require('fs-extra')
const {
  getAllFiles,
  addCommmitMsgPrefix,
  getTempRepo,
  copyFiles
} = require('../utils')
const { CONFIG_FILENAME } = require('../constants')

async function initializeFolder(
  repoUrl,
  folderPaths,
  folderRepoPath,
  branchName
) {
  try {
    const config = {
      repoUrl,
      folders: folderPaths,
      branch: branchName,
      ignore: [CONFIG_FILENAME]
    }
    const mainRepoPath = await getTempRepo(repoUrl, branchName)
    await fs.ensureDir(folderRepoPath)
    const mainRepo = await Git.Repository.open(mainRepoPath)
    await mainRepo.checkoutBranch(branchName)
    const folderRepo = await Git.Repository.init(folderRepoPath, 0)
    await copyFiles(mainRepoPath, folderRepoPath, folderPaths, config.ignore)

    await fs.writeJson(`${folderRepoPath}/${CONFIG_FILENAME}`, config, {
      spaces: 2
    })
    const signature = folderRepo.defaultSignature()
    let index = await folderRepo.refreshIndex()
    for (let addFilePath of (await folderRepo.getStatus()).map(file =>
      file.path()
    )) {
      await index.addByPath(addFilePath)
    }
    await index.write()
    const oid = await index.writeTree()
    // await folderRepo.createCommit(
    //   'HEAD',
    //   signature,
    //   signature,
    //   addCommmitMsgPrefix((await mainRepo.getHeadCommit()).sha()),
    //   oid,
    //   null
    // )
  } catch (e) {
    return Promise.reject(e)
  }
}

module.exports = initializeFolder
