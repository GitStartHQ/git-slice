const { ApolloClient, HttpLink, InMemoryCache } = require('apollo-boost')
const fetch = require('isomorphic-unfetch')
const { getToken } = require('../auth0')
global.fetch = fetch

const HASURA_GRAPHQL_ENGINE_DOMAIN = 'https://hasura.gitstart.com/v1/graphql'

let apolloClient = null

async function getApolloClient() {
  if (!!apolloClient) return apolloClient
  const token = await getToken()
  apolloClient = new ApolloClient({
    link: new HttpLink({
      uri: HASURA_GRAPHQL_ENGINE_DOMAIN,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': `application/json`
      }
    }),
    cache: new InMemoryCache()
  })
  return apolloClient
}

module.exports = {
  getApolloClient
}
