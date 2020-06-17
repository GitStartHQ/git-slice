const gql = require('graphql-tag')
const { getApolloClient } = require('./index')
const { getAllClients } = require('./query')

async function insertClientRepositoryCommit(variables) {
  try {
    const client = await getApolloClient()
    const response = await client.mutate({
      mutation: gql`
        mutation InsertClientRepositoryCommit(
          $clientRepositoryId: uuid!
          $clientBaseCommitSHA: String!
          $slicedCommitSHA: String!
        ) {
          insert_client_repositories_commits(
            objects: {
              clientBaseCommitDate: "now()"
              clientBaseCommitSHA: $clientBaseCommitSHA
              slicedCommitDate: "now()"
              slicedCommitSHA: $slicedCommitSHA
              clientRepositoryId: $clientRepositoryId
            }
          ) {
            returning {
              id
            }
          }
        }
      `,
      variables
    })
    return response.data
  } catch (e) {
    console.log(e)
    return
  }
}

async function addPushCommitInTask(variables) {
  try {
    const client = await getApolloClient()
    const response = await client.mutate({
      mutation: gql`
        mutation addPushCommitInTask(
          $clientCommitSHA: String!
          $slicedCommitSHA: String!
          $clientRepositoryId: uuid!
          # $prLink: String!
        ) {
          insert_client_repositories_commits(
            objects: {
              clientCommitSHA: $clientCommitSHA
              clientCommitDate: "now()"
              slicedCommitSHA: $slicedCommitSHA
              slicedCommitDate: "now()"
              clientRepositoryId: $clientRepositoryId
            }
          ) {
            affected_rows
          }
        }
      `,
      variables
    })
    return response.data
  } catch (e) {
    console.log(e)
    return
  }
}

async function upsertDatabaseFromConfig(config, slicedRepoUrl) {
  if (
    !config.folders ||
    !config.ignore ||
    !config.branch ||
    !config.repoUrl ||
    !slicedRepoUrl
  ) {
    console.log(
      'Config does not have all the fields so unable to save config to the database!'
    )
    return null
  }
  try {
    const client = await getApolloClient()
    const response = await client.mutate({
      mutation: gql`
        mutation UpsertDatabaseFromConfig(
          $slicedFolders: String!
          $ignoredPaths: String!
          $clientBaseBranchName: String!
          $clientRepoUrl: String!
          $slicedRepoUrl: String!
          $clientId: String!
        ) {
          insert_client_repositories(
            objects: {
              ignoredPaths: $ignoredPaths
              slicedFolders: $slicedFolders
              clientBaseBranchName: $clientBaseBranchName
              clientRepoUrl: $clientRepoUrl
              slicedRepoUrl: $slicedRepoUrl
              clientId: $clientId
            }
            on_conflict: {
              constraint: UQ_SLICED_REPO
              update_columns: [
                ignoredPaths
                slicedFolders
                clientBaseBranchName
                clientRepoUrl
                clientId
              ]
            }
          ) {
            affected_rows
          }
        }
      `,
      variables: {
        slicedFolders: config.folders.join(','),
        ignoredPaths: config.ignore.join(','),
        clientBaseBranchName: config.branch,
        clientRepoUrl: config.repoUrl.replace(/\/\/.*@/gm, '//'),
        slicedRepoUrl,
        clientId: await getClientName(slicedRepoUrl.split('/').reverse()[0])
      }
    })
    return response.data
  } catch (e) {
    console.log(e)
    return
  }
}

async function getClientName(repoName) {
  return repoName.split('-')[1]
}

module.exports = {
  insertClientRepositoryCommit,
  addPushCommitInTask,
  upsertDatabaseFromConfig
}
