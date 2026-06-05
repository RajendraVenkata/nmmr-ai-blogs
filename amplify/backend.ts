import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { setUserRole } from './functions/set-user-role/resource';
import { setCoderAccess } from './functions/set-coder-access/resource';

const backend = defineBackend({ auth, data, storage, setUserRole, setCoderAccess });

const { userPool } = backend.auth.resources;

backend.setUserRole.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminRemoveUserFromGroup',
      'cognito-idp:AdminListGroupsForUser',
    ],
    resources: [userPool.userPoolArn],
  }),
);

backend.setUserRole.addEnvironment('USER_POOL_ID', userPool.userPoolId);

backend.setCoderAccess.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminRemoveUserFromGroup'],
    resources: [userPool.userPoolArn],
  }),
);

backend.setCoderAccess.addEnvironment('USER_POOL_ID', userPool.userPoolId);
