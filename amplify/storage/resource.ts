import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'mnnrBlogMedia',
  access: (allow) => ({
    'media/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.groups(['ContentWriter', 'ContentAdmin', 'SystemAdmin']).to([
        'read',
        'write',
        'delete',
      ]),
    ],
  }),
});
