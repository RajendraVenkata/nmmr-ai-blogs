import type { Schema } from '../../data/resource';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();
const CODER_GROUP = 'Coder';

export const handler: Schema['setCoderAccess']['functionHandler'] = async (event) => {
  const { userId, enabled } = event.arguments;
  const userPoolId = process.env.USER_POOL_ID as string;

  const command = enabled
    ? new AdminAddUserToGroupCommand({ GroupName: CODER_GROUP, Username: userId as string, UserPoolId: userPoolId })
    : new AdminRemoveUserFromGroupCommand({ GroupName: CODER_GROUP, Username: userId as string, UserPoolId: userPoolId });

  await client.send(command);
  return JSON.stringify({ userId, isCoder: enabled });
};
