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
        attributeMapping: { email: 'email', fullname: 'name' },
      },
      callbackUrls: [
        'http://localhost:3000/',
        'https://main.d343i0k2u8raax.amplifyapp.com/',
        'https://rajendravenkata.com/',
        'https://www.rajendravenkata.com/',
      ],
      logoutUrls: [
        'http://localhost:3000/',
        'https://main.d343i0k2u8raax.amplifyapp.com/',
        'https://rajendravenkata.com/',
        'https://www.rajendravenkata.com/',
      ],
    },
  },
  groups: ['SystemAdmin', 'ContentAdmin', 'ContentWriter', 'Coder'],
  triggers: { postConfirmation },
  access: (allow) => [
    allow.resource(postConfirmation).to(['addUserToGroup']),
  ],
});
