/* tslint:disable */
/* eslint-disable */
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetClientCreds
// ====================================================

export interface GetClientCreds_client_bots {
  __typename: "client_bots";
  username: string;
  password: string;
  token: string;
}

export interface GetClientCreds {
  /**
   * fetch data from the table: "client_bots"
   */
  client_bots: GetClientCreds_client_bots[];
}

export interface GetClientCredsVariables {
  accessEndpoint: string;
}
