const Git = require("nodegit");
const path = require("path");
const fs = require("fs-extra");
const {
  getAllFiles,
  getCurBranch,
  removeCommitMsgPrefix,
  getLastGitSliceCommitHash,
  cloneMainRepo,
  copyFiles,
  deleteFiles
} = require("../utils");
const { CONFIG_FILENAME } = require("../constants");

async function updateMainFromFolder(
  currentDir,
  branchName,
  commitMsg,
  authorName,
  authorEmail
) {
  try {
    const config = await fs.readJson(path.resolve(currentDir, CONFIG_FILENAME));
    const mainRepoPath = await cloneMainRepo(currentDir, config.repoUrl);
    const mainRepo = await Git.Repository.open(mainRepoPath);
    await mainRepo.checkoutBranch(config.branch);
    const folderRepo = await Git.Repository.open(currentDir);
    const curBranchName = await getCurBranch(folderRepo);
    if ((await folderRepo.getStatus()).length) {
      throw "Error: cannot push with uncommitted changes";
    }
    if (curBranchName === "master") {
      throw "Error: cannot push from master branch";
    }
    if (
      (await mainRepo.getReferenceNames(Git.Reference.TYPE.LISTALL)).indexOf(
        `refs/heads/${branchName}`
      ) === -1
    ) {
      await folderRepo.checkoutBranch("master");
      const commitHash = await getLastGitSliceCommitHash(folderRepo);
      await folderRepo.checkoutBranch(curBranchName);
      const newBranch = await mainRepo.createBranch(
        branchName,
        commitHash,
        0 // gives error if the branch already exists
      );
    } else {
      console.log("Branch already exists");
    }
    await mainRepo.checkoutBranch(branchName);
    await mainRepo.setHead(`refs/heads/${branchName}`);

    for (let p of config.folders) {
      for (let file of await getAllFiles(path.resolve(mainRepoPath, p))) {
        if (
          !await Git.Ignore.pathIsIgnored(mainRepo, file) &&
          config.ignore.indexOf(path.relative(mainRepoPath, file)) === -1
        ) {
          await fs.remove(file);
        }
      }
    }

    await copyFiles(currentDir, mainRepoPath, config.folders, config.ignore);


    const repoStatus = await mainRepo.getStatus();
    if (repoStatus.length) {
      const signature = Git.Signature.now(authorName, authorEmail);
      let index = await mainRepo.refreshIndex();
      for (let deletedFilePath of repoStatus
        .filter(file => file.isDeleted())
        .map(file => file.path())) {
        await index.remove(deletedFilePath, 0);
      }
      for (let addOrModifiedFilePath of repoStatus
        .filter(file => !file.isDeleted())
        .map(file => file.path())) {
        await index.addByPath(addOrModifiedFilePath);
      }
      await index.write();
      const oid = await index.writeTree();
      const parent = await mainRepo.getCommit(
        await Git.Reference.nameToId(mainRepo, "HEAD")
      );
      await mainRepo.createCommit(
        "HEAD",
        signature,
        signature,
        commitMsg,
        oid,
        [parent]
      );
      const curBranchName = await getCurBranch(folderRepo);
      console.log(`${mainRepoPath} updated`);
    } else {
      console.log(`${mainRepoPath} already up-to-date`);
    }
  } catch (e) {
    return Promise.reject(e);
  }
}

module.exports = updateMainFromFolder;
