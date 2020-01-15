const Git = require('nodegit')
const path = require('path')
const fs = require('fs-extra')
const {
  getClientRepository,
  getClientCommitMessage,
  getClientCreds
} = require('../graphlql/query')
const {
  addPushCommitInTask,
  upsertDatabaseFromConfig
} = require('../graphlql/mutations')
const {
  getAllFiles,
  getCurBranch,
  getLastGitSliceCommitHash,
  getTempRepo,
  copyFiles,
  pushTempRepo,
  findFile,
  createOrPullBranch
} = require('../utils')

const { CONFIG_FILENAME } = require('../constants')

const { CIRCLE_REPOSITORY_URL, CIRCLE_PULL_REQUEST } = process.env

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
    await upsertDatabaseFromConfig(config, CIRCLE_REPOSITORY_URL)
    const [clientRepoDetails, clientCommitMessageData] = await Promise.all([
      getClientRepository(CIRCLE_REPOSITORY_URL),
      getClientCommitMessage(CIRCLE_PULL_REQUEST)
    ])
    let clientRepoUrl = config.repoUrl
    let clientBaseBranchName = config.branch
    if (!!clientRepoDetails) {
      clientRepoUrl = clientRepoDetails.clientRepoUrl || config.repo
      clientBaseBranchName =
        clientRepoDetails.clientBaseBranchName || config.branch
    }

    const clientCommitMessage =
      commitMsg ||
      (clientCommitMessageData && clientCommitMessageData.clientCommitMessage
        ? clientCommitMessageData.clientCommitMessage
        : 'implementation')

    const creds = await getClientCreds(clientRepoUrl)
    if (!!creds && creds.username && (creds.token || creds.password)) {
      authorName = creds.username
      password = !!creds.token ? creds.token : creds.password
    }
    if (!clientRepoUrl.includes(`//${authorName}@`)) {
      clientRepoUrl = clientRepoUrl.replace('//', `//${authorName}@`)
    }

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

    if ((await folderRepo.getStatus()).length) {
      throw 'Error: cannot push with uncommitted changes'
    }
    if (curBranchName === 'master') {
      throw 'Error: cannot push from master branch'
    }

    await folderRepo.checkoutBranch('master')
    const commitHash = await getLastGitSliceCommitHash(folderRepo)
    await folderRepo.checkoutBranch(curBranchName)

    await createOrPullBranch(mainRepo, branchName, commitHash)

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
      const commitOid = await mainRepo.createCommit(
        'HEAD',
        signature,
        signature,
        clientCommitMessage,
        oid,
        [parent]
      )

      await pushTempRepo(clientRepoUrl, branchName)

      const pushedCommitSHA = (await folderRepo.getHeadCommit()).sha()
      const clientCommitSHA = (await mainRepo.getHeadCommit()).sha()

      await addPushCommitInTask({
        prLink: CIRCLE_PULL_REQUEST,
        clientCommitSHA,
        slicedCommitSHA: pushedCommitSHA,
        clientRepositoryId: clientRepoDetails && clientRepoDetails.id
      })
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
