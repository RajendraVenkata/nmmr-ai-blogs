import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const seed = (process.env.SEED_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = (event.request.userAttributes.email ?? '').toLowerCase();

  if (seed.includes(email)) {
    await client.send(
      new AdminAddUserToGroupCommand({
        GroupName: 'SystemAdmin',
        Username: event.userName,
        UserPoolId: event.userPoolId,
      }),
    );
  }
  return event;
};
