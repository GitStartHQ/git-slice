const parseArgsAndExecute = require("../lib");
const { CONFIG_FILENAME, TEMPORARY_FOLDER_NAME } = require("../lib/constants");
const Git = require("nodegit");
const path = require("path");
const fs = require("fs-extra");
const { getCurBranch, getAllFiles, addCommmitMsgPrefix } = require("../lib/utils");

const folderRepoRelativePath = "./repos/pull";
const folderRepoPath = path.resolve(__dirname, folderRepoRelativePath);
const mainRepoPath = TEMPORARY_FOLDER_NAME;

const repoToClone = "https://github.com/arslanarshad31/trello-react.git";
const folderPaths = ["public", "src/reducers"]; // to be modified with the repo
const folderPathRegExp = new RegExp(folderPaths.join("|^"));
let mainRepo;
let folderRepo;
const branchName = "master";


beforeEach(async done => {
  jest.setTimeout(10000);
  const initCmd = `init ${folderRepoRelativePath} --repo ${repoToClone} --folder ${
    folderPaths[0]
  } --folder ${folderPaths[1]} --branch ${branchName}`;
  await parseArgsAndExecute(__dirname, initCmd.split(" "));
  mainRepo = await Git.Repository.open(mainRepoPath);
  folderRepo = await Git.Repository.open(folderRepoPath);
  done();
});

afterEach(async done => {
  await fs.remove(folderRepoPath);
  done();
});

afterAll(async done => {
  await fs.remove(mainRepoPath);
  done();
});

describe("Folder repo is synced properly with main repo", () => {
  test("all unignored files are copied - check by counting", async () => {
    const filesToCopy = (await mainRepo.index())
      .entries()
      .filter(x => folderPathRegExp.test(x.path));
    const copiedFiles = (await folderRepo.index())
      .entries()
      .filter(x => x.path !== ".gitignore");
    // excluding the config file
    expect(copiedFiles.length - 1).toBe(filesToCopy.length);
  });
  test("all unignored files are copied - check by name and file size", async () => {
    const filesToCopy = (await mainRepo.index())
      .entries()
      .filter(x => folderPathRegExp.test(x.path));
    const copiedFiles = (await folderRepo.index())
      .entries()
      .filter(x => x.path !== ".gitignore")
      .filter(x => x.path !== CONFIG_FILENAME);
    expect(
      copiedFiles.map(({ fileSize, path }) => ({ fileSize, path }))
    ).toEqual(filesToCopy.map(({ fileSize, path }) => ({ fileSize, path })));
  });
  test("proper commit is made in the forked folder", async () => {
    const expected = addCommmitMsgPrefix((await mainRepo.getMasterCommit()).sha());
    const output = (await folderRepo.getMasterCommit()).message();
    expect(output).toBe(expected);
    await fs.remove(folderRepoPath);
  });

  test("checkouts to the master branch before pulling", async () => {
    let branchName = "pull-test-branch";
    await folderRepo.createBranch(
      branchName,
      (await folderRepo.getMasterCommit()).sha(),
      0 // gives error if the branch already exists
    );
    await folderRepo.checkoutBranch(branchName);
    await folderRepo.setHead(`refs/heads/${branchName}`);
    await parseArgsAndExecute(folderRepoPath, ["pull"]);
    expect(await getCurBranch(folderRepo)).toBe("master");
  });

  test("does not pull if there are uncommitted changes", async () => {
    expect.assertions(1);
    const testFilePath = path.resolve(
      folderRepoPath,
      folderPaths[0],
      "testFile1.txt"
    );
    const testFileText = "Some unimportant text";
    await fs.outputFile(testFilePath, testFileText);
    try {
      await parseArgsAndExecute(folderRepoPath, ["pull"]);
    } catch (e) {
      expect(e).toBe("Error: cannot pull with uncommitted changes");
    }
  });
});
