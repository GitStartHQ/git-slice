/* tslint:disable */
/* eslint-disable */
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL mutation operation: InsertClientRepositoryCommit
// ====================================================

export interface InsertClientRepositoryCommit_insert_client_repositories_commits_returning {
  __typename: "client_repositories_commits";
  id: any;
}

export interface InsertClientRepositoryCommit_insert_client_repositories_commits {
  __typename: "client_repositories_commits_mutation_response";
  /**
   * data of the affected rows by the mutation
   */
  returning: InsertClientRepositoryCommit_insert_client_repositories_commits_returning[];
}

export interface InsertClientRepositoryCommit {
  /**
   * insert data into the table: "client_repositories_commits"
   */
  insert_client_repositories_commits: InsertClientRepositoryCommit_insert_client_repositories_commits | null;
}

export interface InsertClientRepositoryCommitVariables {
  clientRepositoryId: any;
  clientBaseCommitSHA: string;
  slicedCommitSHA: string;
}
