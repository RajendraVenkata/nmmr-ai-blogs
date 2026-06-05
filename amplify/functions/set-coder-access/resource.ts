import { defineFunction } from '@aws-amplify/backend';

export const setCoderAccess = defineFunction({
  name: 'set-coder-access',
  resourceGroupName: 'data',
});
