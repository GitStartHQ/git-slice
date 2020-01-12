/* tslint:disable */
/* eslint-disable */
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL mutation operation: addPushCommitInTask
// ====================================================

export interface addPushCommitInTask_insert_client_repositories_commits {
  __typename: "client_repositories_commits_mutation_response";
  /**
   * number of affected rows by the mutation
   */
  affected_rows: number;
}

export interface addPushCommitInTask {
  /**
   * insert data into the table: "client_repositories_commits"
   */
  insert_client_repositories_commits: addPushCommitInTask_insert_client_repositories_commits | null;
}

export interface addPushCommitInTaskVariables {
  clientCommitSHA: string;
  slicedCommitSHA: string;
  clientRepositoryId: any;
  prLink: string;
}
