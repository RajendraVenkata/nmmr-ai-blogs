import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  environment: {
    // Comma-separated emails auto-promoted to SystemAdmin on sign-up.
    SEED_ADMIN_EMAILS: process.env.SEED_ADMIN_EMAILS ?? '',
  },
});
