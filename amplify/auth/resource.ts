import { defineAuth, secret } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: { email: 'email' },
      },
      callbackUrls: ['http://localhost:3000/'],
      logoutUrls: ['http://localhost:3000/'],
    },
  },
  groups: ['SystemAdmin', 'ContentAdmin', 'ContentWriter'],
  triggers: { postConfirmation },
  access: (allow) => [
    allow.resource(postConfirmation).to(['addUserToGroup']),
  ],
});
