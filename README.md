# MNNR AI Blogs

Role-based blogging platform — Next.js 14 + AWS Amplify Gen 2 (Cognito, AppSync/DynamoDB, S3).

## Local development

1. Install deps: `npm install`
2. Start the Amplify sandbox (writes `amplify_outputs.json`):
   ```bash
   SEED_ADMIN_EMAILS="you@example.com" npx ampx sandbox
   ```
3. In another terminal: `npm run dev` → http://localhost:3000
4. Register with a seed email to get auto-promoted to SystemAdmin.

## Tests

```bash
npm test
```

## Roles

Reader → ContentWriter → ContentAdmin → SystemAdmin (Cognito groups). SystemAdmins
assign roles at `/admin`. Content is never hard-deleted — deletes set `status=DELETED`.

## Deploy (later)

Connect the repo to AWS Amplify Hosting; Amplify builds the Next.js app and the
`amplify/` backend together.
