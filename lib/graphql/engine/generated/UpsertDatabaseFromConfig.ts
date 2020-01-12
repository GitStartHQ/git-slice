/* tslint:disable */
/* eslint-disable */
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL mutation operation: UpsertDatabaseFromConfig
// ====================================================

export interface UpsertDatabaseFromConfig_insert_client_repositories {
  __typename: "client_repositories_mutation_response";
  /**
   * number of affected rows by the mutation
   */
  affected_rows: number;
}

export interface UpsertDatabaseFromConfig {
  /**
   * insert data into the table: "client_repositories"
   */
  insert_client_repositories: UpsertDatabaseFromConfig_insert_client_repositories | null;
}

export interface UpsertDatabaseFromConfigVariables {
  slicedFolders: string;
  ignoredPaths: string;
  clientBaseBranchName: string;
  clientRepoUrl: string;
  slicedRepoUrl: string;
  clientId: string;
}
