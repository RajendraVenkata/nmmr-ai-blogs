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

## Phase 2 — access & admin

- Users request elevated roles at `/account` (ContentWriter / ContentAdmin).
- System admins manage everything under `/admin`:
  - `/admin/requests` — approve/reject access requests.
  - `/admin/users` — change any user's role.
  - `/admin/moderation` — view and restore soft-deleted posts/comments
    (posts restore to draft, comments to active).
- Roles map to Cognito groups (the authority); `UserProfile` mirrors them for the
  admin user list and is upserted on sign-in.

## Deploy (later)

Connect the repo to AWS Amplify Hosting; Amplify builds the Next.js app and the
`amplify/` backend together.

## UI

News/editorial theme: dark sticky nav (Menu dropdown + centered wordmark + search),
two-column home page (lead article + Latest/Topics sidebar), category chips from the
post's first tag, cover images (set per post in the editor; a colored placeholder is
shown when absent), and article-grade markdown via the Tailwind typography plugin.
The nav search icon filters the home feed client-side.
