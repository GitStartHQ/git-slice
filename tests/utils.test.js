const Git = require('nodegit')
const fs = require('fs-extra')
const path = require('path')
const parseArgsAndExecute = require('../lib')

const mainRepoRelativePath = './repos/utils/main'
const folderRepoRelativePath = './repos/utils/folder'
const mainRepoPath = path.resolve(__dirname, mainRepoRelativePath)
const folderRepoPath = path.resolve(__dirname, folderRepoRelativePath)
const {
  getAllFiles,
  getCurBranch,
  addCommmitMsgPrefix,
  removeCommitMsgPrefix,
  ensureArray,
  getLastGitSliceCommitHash
} = require('../lib/utils')

const folderPaths = ['src'] // to be modified with the repo
const folderPathRegExp = new RegExp(folderPaths.join('|^'))
let folderRepo
let mainRepo
const branchName = 'master'
const COMMIT_MSG_PREFIX = 'git-slice:'
const fileName = 'public/initial.txt'
const fileContent = 'Hello World'

beforeAll(async () => {
  mainRepo = await Git.Repository.init(mainRepoPath, 0)
  await fs.outputFile(path.resolve(mainRepoPath, fileName), fileContent)
  let index = await mainRepo.refreshIndex()
  await index.addByPath(fileName)
  await index.write()
  const oid = await index.writeTree()
  const signature = mainRepo.defaultSignature()
  await mainRepo.setHead(`refs/heads/${branchName}`)
  await mainRepo.createCommit(
    'HEAD',
    signature,
    signature,
    `initial commit`,
    oid,
    []
  )
})

beforeEach(async () => {
  const initCmd = `init ${folderRepoRelativePath} --repo ${mainRepoRelativePath} --folder ${
    folderPaths[0]
  } --branch ${branchName}`
  await parseArgsAndExecute(__dirname, initCmd.split(' '))
  folderRepo = await Git.Repository.open(folderRepoPath)
})

afterEach(async () => {
  await fs.remove(folderRepoPath)
})

afterAll(async () => {
  await fs.remove(mainRepoPath)
})

describe('ensureArray', () => {
  it('should return an empty array if input is empty or null', () => {
    expect(ensureArray('')).toEqual([])
    expect(ensureArray(null)).toEqual([])
    expect(ensureArray(undefined)).toEqual([])
  })

  it('should convert primitive to array', () => {
    expect(ensureArray(5)).toEqual([5])
  })

  it('should convert objects to array', () => {
    const expectResult = [{ id: 1, author: 'test' }]
    expect(ensureArray({ id: 1, author: 'test' })).toEqual(expectResult)
  })
})

describe('getCurBranch', () => {
  it('should return the master branch', async () => {
    expect(await getCurBranch(folderRepo)).toBe('master')
  })

  it('should return current branch name after successful checkout', async () => {
    const testBranch = 'test-branch'
    await folderRepo.createBranch(
      testBranch,
      (await folderRepo.getMasterCommit()).sha(),
      true
    )
    await folderRepo.checkoutBranch(testBranch)
    await folderRepo.setHead(`refs/heads/${testBranch}`)
    expect(await getCurBranch(folderRepo)).toBe('test-branch')
  })
})

describe('addCommitMsgPrefix', () => {
  it('should add correct message prefix always', () => {
    const commitMessage = 'Add test files'
    expect(addCommmitMsgPrefix(commitMessage)).toBe(
      `${COMMIT_MSG_PREFIX}${commitMessage}`
    )
  })
})

describe('removeCommitMsgPrefix', () => {
  it('should remove commit message prefix', () => {
    const commitMessage = `${COMMIT_MSG_PREFIX}Add test files`
    expect(removeCommitMsgPrefix(commitMessage)).toBe('Add test files')
  })
})

describe('getAllFiles', () => {
  let allFiles
  const test1Path = path.resolve(folderRepoPath, folderPaths[0], 'test1.txt')
  const test2Path = path.resolve(folderRepoPath, folderPaths[1], 'test2.txt')

  const test1Text = 'Test 1!'
  const test2Text = 'Test 2!'

  it('should return the current files in the directory', async () => {
    allFiles = await getAllFiles(folderRepoPath)
    expect(allFiles.length).toBe(16)
  })

  it('should return all files in a directory', async () => {
    await fs.outputFile(test1Path, test1Text)
    await fs.outputFile(test2Path, test2Text)
    allFiles = await getAllFiles(folderRepoPath)
    expect(allFiles.length).toBe(18)
    expect(await fs.readFile(test1Path, 'utf8')).toBe('Test 1!')
    expect(await fs.readFile(test2Path, 'utf8')).toBe('Test 2!')
  })

  it('should return an empty array', async () => {
    await fs.remove(folderRepoPath)
    const currentDir = path.resolve(__dirname, 'repos/utils/test')
    fs.ensureDirSync(currentDir)
    allFiles = await getAllFiles(currentDir)
    expect(allFiles).toEqual([])
  })
})

describe('getLastGitSliceCommitHash', () => {
  it('should return last git slice commit hash', async () => {
    const expectedCommitHash = (await mainRepo.getCommit(
      await Git.Reference.nameToId(mainRepo, 'HEAD')
    )).sha()
    expect(await getLastGitSliceCommitHash(folderRepo)).toBe(expectedCommitHash)
  })
})
