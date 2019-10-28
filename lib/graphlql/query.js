const gql = require('graphql-tag')
const { getApolloClient } = require('./index')

async function getClientRepository(slicedRepoUrl) {
  try {
    const client = await getApolloClient()
    const response = await client.query({
      query: gql`
        query GetClientRepository($slicedRepoUrl: String_comparison_exp!) {
          client_repositories(where: { slicedRepoUrl: $slicedRepoUrl }) {
            id
            clientRepoUrl
            clientBaseBranchName
          }
        }
      `,
      variables: { slicedRepoUrl: { _eq: slicedRepoUrl } }
    })
    return response.data.client_repositories[0]
  } catch (e) {
    console.log(e)
    return
  }
}

async function getClientCommitMessage(prLink) {
  try {
    const client = await getApolloClient()
    const response = await client.query({
      query: gql`
        query GetClientCommitMessage($prLink: String_comparison_exp!) {
          tasks(where: { prLink: $prLink }) {
            clientCommitMessage
          }
        }
      `,
      variables: { prLink: { _eq: prLink } }
    })
    return response.data.tasks[0]
  } catch (e) {
    console.log(e)
    return
  }
}

async function getClientCreds(clientRepoUrl) {
  try {
    const client = await getApolloClient()
    const response = await client.query({
      query: gql`
        query GetClientCreds($accessEndpoint: String!) {
          client_bots(
            where: {
              accessEndpoint: { _eq: $accessEndpoint }
              type: { _eq: "github" }
            }
          ) {
            id
            username
            password
            token
          }
        }
      `,
      variables: { accessEndpoint: getAccessEndpointFromRepoUrl(clientRepoUrl) }
    })
    return response.data.client_bots[0]
  } catch (e) {
    console.log(e)
    return
  }
}

function getAccessEndpointFromRepoUrl(repoUrl) {
  repoUrl = repoUrl.replace(/\/\/.*@/gm, '//')
  return repoUrl.substr(0, repoUrl.lastIndexOf('/'))
}

module.exports = {
  getClientRepository,
  getClientCommitMessage,
  getClientCreds
}
