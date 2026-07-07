import { GraphQLClient } from 'graphql-request';

const endpoint = 'https://api.wahanadigital.com/graphql';

export const client = new GraphQLClient(endpoint);