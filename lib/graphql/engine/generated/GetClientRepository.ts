/* tslint:disable */
/* eslint-disable */
// This file was automatically generated and should not be edited.

import { String_comparison_exp } from "./globalTypes";

// ====================================================
// GraphQL query operation: GetClientRepository
// ====================================================

export interface GetClientRepository_client_repositories {
  __typename: "client_repositories";
  id: any;
  clientRepoUrl: string;
  clientBaseBranchName: string;
}

export interface GetClientRepository {
  /**
   * fetch data from the table: "client_repositories"
   */
  client_repositories: GetClientRepository_client_repositories[];
}

export interface GetClientRepositoryVariables {
  slicedRepoUrl: String_comparison_exp;
}
