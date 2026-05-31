import { defineFunction } from '@aws-amplify/backend';

export const setUserRole = defineFunction({
  name: 'set-user-role',
  resourceGroupName: 'data',
});
