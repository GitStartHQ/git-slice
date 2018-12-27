const parseArgsAndExecute = require('../lib')
const { CONFIG_FILENAME } = require('../lib/constants')
const Git = require('nodegit')
const path = require('path')
const fs = require('fs-extra')
const {
  getCurBranch,
  getAllFiles,
  addCommmitMsgPrefix,
  getTempRepoPath
} = require('../lib/utils')

const folderRepoRelativePath = './repos/pull'
const folderRepoPath = path.resolve(__dirname, folderRepoRelativePath)

const repoToClone = 'https://github.com/juliopiubello/tiny-repo'
const folderPaths = ['src'] // to be modified with the repo
const folderPathRegExp = new RegExp(folderPaths.join('|^'))
const branchName = 'master'

let mainRepoPath
let mainRepo
let folderRepo

beforeAll(() => {
  mainRepoPath = getTempRepoPath(repoToClone)
  console.log(mainRepoPath)
})

beforeEach(async done => {
  jest.setTimeout(10000)
  const initCmd = `init ${folderRepoRelativePath} --repo ${repoToClone} --folder ${
    folderPaths[0]
  } --folder ${folderPaths[1]} --branch ${branchName}`
  await parseArgsAndExecute(__dirname, initCmd.split(' '))
  mainRepo = await Git.Repository.open(mainRepoPath)
  folderRepo = await Git.Repository.open(folderRepoPath)
  done()
})

afterEach(async done => {
  await fs.remove(folderRepoPath)
  done()
})

afterAll(async done => {
  console.log('mainRepoPath local, ', mainRepoPath)
  if (fs.existsSync(mainRepoPath)) {
    console.log('file exists')
    await fs.remove(mainRepoPath)
  }
  done()
})

describe('Folder repo is synced properly with main repo', () => {
  test('all unignored files are copied - check by counting', async () => {
    const filesToCopy = (await mainRepo.index())
      .entries()
      .filter(x => folderPathRegExp.test(x.path))
    const copiedFiles = (await folderRepo.index())
      .entries()
      .filter(x => x.path !== '.gitignore')
      .filter(x => folderPathRegExp.test(x.path))
    // -1 excluding the config file
    let a1 = ''
    let a2 = ''
    for (let a = 0; a < copiedFiles.length; a++) {
      a1 += copiedFiles[a].path + ', '
    }
    for (let b = 0; b < filesToCopy.length; b++) {
      a2 += filesToCopy[b].path + ', '
    }
    console.log(a1)
    console.log(copiedFiles.length)
    console.log(a2)
    console.log(filesToCopy.length)
    expect(copiedFiles.length).toBe(filesToCopy.length)
  })

  // test('all unignored files are copied - check by name and file size', async () => {
  //   const filesToCopy = (await mainRepo.index())
  //     .entries()
  //     .filter(x => folderPathRegExp.test(x.path))
  //   const copiedFiles = (await folderRepo.index())
  //     .entries()
  //     .filter(x => x.path !== '.gitignore')
  //     .filter(x => x.path !== CONFIG_FILENAME)
  //   expect(
  //     copiedFiles.map(({ fileSize, path }) => ({ fileSize, path }))
  //   ).toEqual(filesToCopy.map(({ fileSize, path }) => ({ fileSize, path })))
  // })

  // test('proper commit is made in the forked folder', async () => {
  //   const expected = addCommmitMsgPrefix(
  //     (await mainRepo.getMasterCommit()).sha()
  //   )
  //   const output = (await folderRepo.getMasterCommit()).message()
  //   expect(output).toBe(expected)
  // })

  // test('checkouts to the master branch before pulling', async () => {
  //   let branchName = 'pull-test-branch'
  //   await folderRepo.createBranch(
  //     branchName,
  //     (await folderRepo.getMasterCommit()).sha(),
  //     0 // gives error if the branch already exists
  //   )
  //   await folderRepo.checkoutBranch(branchName)
  //   await folderRepo.setHead(`refs/heads/${branchName}`)
  //   await parseArgsAndExecute(folderRepoPath, ['pull'])
  //   console.log(folderRepo)
  //   console.log('?????')
  //   const res = await folderRepo.getCurrentBranch();
  //   console.log(res)
  //   expect(await getCurBranch(folderRepo)).toBe('master')
  // })

  // test('does not pull if there are uncommitted changes', async () => {
  //   expect.assertions(1)
  //   const testFilePath = path.resolve(
  //     folderRepoPath,
  //     folderPaths[0],
  //     'testFile1.txt'
  //   )
  //   const testFileText = 'Some unimportant text'
  //   await fs.outputFile(testFilePath, testFileText)
  //   try {
  //     await parseArgsAndExecute(folderRepoPath, ['pull'])
  //   } catch (e) {
  //     expect(e).toBe('Error: cannot pull with uncommitted changes')
  //   }
  // })
})
