import type { Schema } from '../../data/resource';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();
const MANAGED_GROUPS = ['ContentWriter', 'ContentAdmin', 'SystemAdmin'];
const ROLE_TO_GROUP: Record<string, string | null> = {
  READER: null,
  CONTENT_WRITER: 'ContentWriter',
  CONTENT_ADMIN: 'ContentAdmin',
  SYSTEM_ADMIN: 'SystemAdmin',
};

export const handler: Schema['setUserRole']['functionHandler'] = async (event) => {
  const { userId, role } = event.arguments;
  const userPoolId = process.env.USER_POOL_ID as string;
  const target = ROLE_TO_GROUP[role as string];

  // Remove from every managed group first so role changes are idempotent.
  for (const group of MANAGED_GROUPS) {
    await client
      .send(
        new AdminRemoveUserFromGroupCommand({
          GroupName: group,
          Username: userId as string,
          UserPoolId: userPoolId,
        }),
      )
      .catch(() => undefined);
  }

  if (target) {
    await client.send(
      new AdminAddUserToGroupCommand({
        GroupName: target,
        Username: userId as string,
        UserPoolId: userPoolId,
      }),
    );
  }

  return JSON.stringify({ userId, role });
};
