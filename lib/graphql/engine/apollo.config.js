module.exports = {
  client: {
    includes: ['./**/*.ts', './**/*.js'],
    service: {
      name: 'hasura',
      url: 'https://hasura.gitstart.dev/v1/graphql',
      // optional headers
      headers: {
        'x-hasura-admin-secret': 'helloworld'
      }
    }
  }
}
