# MNNR AI Blogs — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of a role-based blogging platform — Cognito auth, markdown authoring with S3 media, a public feed + post detail with comments and social sharing, soft-delete everywhere, and a minimal system-admin role-assignment screen.

**Architecture:** Next.js 14 App Router (TypeScript, Tailwind) frontend talking to an AWS Amplify Gen 2 backend (`amplify/`): Cognito user pool with groups, Amplify Data (AppSync GraphQL over DynamoDB), S3 storage, and two Lambdas (seed-admin bootstrap on sign-up, role assignment). Pure logic (slugs, share URLs, permissions, sanitization, soft-delete filters) lives in a unit-tested `src/lib` library.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, `aws-amplify` v6, `@aws-amplify/ui-react`, `@aws-amplify/adapter-nextjs`, `@aws-amplify/backend` + `backend-cli`, `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize`, `@uiw/react-md-editor`, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-31-blogging-platform-design.md`

**Working directory:** repo root `nmmr-ai-blogs/`. All paths below are relative to it.

---

## File structure (created across the plan)

```
amplify/
  backend.ts                          # defineBackend + IAM wiring
  auth/resource.ts                    # Cognito + groups + trigger
  auth/post-confirmation/resource.ts  # seed-admin Lambda definition
  auth/post-confirmation/handler.ts   # promote seed emails to SystemAdmin
  data/resource.ts                    # schema (models + custom mutation)
  storage/resource.ts                 # S3 bucket
  functions/set-user-role/resource.ts # role-assign Lambda definition
  functions/set-user-role/handler.ts  # Cognito group add/remove
src/
  app/layout.tsx                      # root layout + Amplify config + nav
  app/page.tsx                        # public feed
  app/globals.css                     # Tailwind
  app/posts/[slug]/page.tsx           # post detail
  app/auth/page.tsx                   # sign in / up
  app/account/page.tsx                # profile
  app/studio/page.tsx                 # authoring dashboard
  app/studio/posts/new/page.tsx       # create post
  app/studio/posts/[id]/edit/page.tsx # edit post
  app/admin/page.tsx                  # role assignment
  components/ConfigureAmplify.tsx     # Amplify.configure (client)
  components/Nav.tsx                   # top nav, role-aware
  components/PostEditor.tsx            # markdown editor + media upload
  components/MarkdownView.tsx          # sanitized markdown renderer
  components/ShareButtons.tsx          # LinkedIn / X / Facebook
  components/Comments.tsx              # comment list + form
  components/RequireRole.tsx           # client auth/role gate
  lib/client.ts                        # generateClient<Schema>()
  lib/slug.ts
  lib/share.ts
  lib/roles.ts
  lib/sanitize.ts
  lib/posts.ts                         # soft-delete filters
  lib/useCurrentUser.ts                # hook: session + role
tests/
  slug.test.ts  share.test.ts  roles.test.ts  sanitize.test.ts  posts.test.ts
```

> **Auth-rule note (read before Task 5):** AppSync declarative rules can't express
> "in group ContentWriter AND owns the record." We enforce **who may author** at the
> data layer (only the three author groups get `create`/`update`), and enforce
> **writers edit their own posts only** at the application layer (`canEditPost` +
> UI). Readers (no group) cannot create/update at the data layer. No `delete` is
> granted on any model, which structurally guarantees the no-hard-delete rule.

---

## Task 1: Scaffold Next.js app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize the Next.js project (non-interactive)**

Run from repo root:
```bash
npx create-next-app@14 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
If it refuses because the directory is non-empty, scaffold in a temp dir and copy:
```bash
npx create-next-app@14 .nextapp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
cp -R .nextapp/. . && rm -rf .nextapp
```
Expected: `src/app/`, `package.json`, `tailwind.config.ts` exist.

- [ ] **Step 2: Confirm dev server boots**

Run: `npm run dev` then visit `http://localhost:3000`, then stop it (Ctrl-C).
Expected: default Next.js page renders with no errors.

- [ ] **Step 3: Append Amplify outputs to `.gitignore`**

Add these lines to `.gitignore`:
```
amplify_outputs.json
.amplify/
amplifyconfiguration*
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with TypeScript and Tailwind"
```

---

## Task 2: Add dependencies and Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime + backend + test dependencies**

```bash
npm install aws-amplify@^6 @aws-amplify/ui-react@^6 @aws-amplify/adapter-nextjs@^1 \
  react-markdown remark-gfm rehype-raw rehype-sanitize @uiw/react-md-editor
npm install -D @aws-amplify/backend @aws-amplify/backend-cli aws-cdk-lib constructs \
  @aws-sdk/client-cognito-identity-provider aws-lambda @types/aws-lambda \
  vitest @types/node tsx
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add scripts to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest",
"sandbox": "npx ampx sandbox",
"sandbox:once": "npx ampx sandbox --once"
```

- [ ] **Step 4: Verify the test runner starts**

Run: `npm test`
Expected: Vitest runs and reports "No test files found" (exit 0 or 1 with that message) — runner is wired.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: add Amplify, markdown, and Vitest dependencies"
```

---

## Task 3: Pure-logic library — slug generation (TDD)

**Files:**
- Create: `tests/slug.test.ts`, `src/lib/slug.ts`

- [ ] **Step 1: Write the failing test** — `tests/slug.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases, trims, and hyphenates', () => {
    expect(slugify('  Hello, World! ')).toBe('hello-world');
  });
  it('collapses repeated separators', () => {
    expect(slugify('A  --  B')).toBe('a-b');
  });
  it('strips non-alphanumeric characters', () => {
    expect(slugify('Café & Co.')).toBe('caf-co');
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when unused', () => {
    expect(uniqueSlug('My Post', [])).toBe('my-post');
  });
  it('appends an incrementing suffix on collision', () => {
    expect(uniqueSlug('My Post', ['my-post', 'my-post-2'])).toBe('my-post-3');
  });
  it('falls back to "post" for empty input', () => {
    expect(uniqueSlug('!!!', [])).toBe('post');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slug.test.ts`
Expected: FAIL — cannot resolve `@/lib/slug`.

- [ ] **Step 3: Write `src/lib/slug.ts`**

```ts
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function uniqueSlug(title: string, existing: string[]): string {
  const base = slugify(title) || 'post';
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
```

- [ ] **Step 4: Ensure Vitest resolves the `@/` alias** — confirm `vitest.config.ts` reads paths from tsconfig by adding the alias explicitly:

Replace `vitest.config.ts` contents with:
```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/slug.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add slug generation with collision handling"
```

---

## Task 4: Pure-logic library — social share URLs (TDD)

**Files:**
- Create: `tests/share.test.ts`, `src/lib/share.ts`

- [ ] **Step 1: Write the failing test** — `tests/share.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { linkedInShareUrl, xShareUrl, facebookShareUrl } from '@/lib/share';

const payload = { url: 'https://blog.test/posts/hello', title: 'Hello & Bye' };

describe('share URLs', () => {
  it('builds a LinkedIn URL with an encoded post URL', () => {
    expect(linkedInShareUrl(payload)).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fblog.test%2Fposts%2Fhello',
    );
  });
  it('builds an X URL with encoded url and text', () => {
    expect(xShareUrl(payload)).toBe(
      'https://twitter.com/intent/tweet?url=https%3A%2F%2Fblog.test%2Fposts%2Fhello&text=Hello%20%26%20Bye',
    );
  });
  it('builds a Facebook URL with an encoded post URL', () => {
    expect(facebookShareUrl(payload)).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fblog.test%2Fposts%2Fhello',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/share.test.ts`
Expected: FAIL — cannot resolve `@/lib/share`.

- [ ] **Step 3: Write `src/lib/share.ts`**

```ts
export interface SharePayload {
  url: string;
  title: string;
}

export function linkedInShareUrl({ url }: SharePayload): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export function xShareUrl({ url, title }: SharePayload): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
}

export function facebookShareUrl({ url }: SharePayload): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/share.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add LinkedIn/X/Facebook share URL builders"
```

---

## Task 5: Pure-logic library — roles & permissions (TDD)

**Files:**
- Create: `tests/roles.test.ts`, `src/lib/roles.ts`

- [ ] **Step 1: Write the failing test** — `tests/roles.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  roleFromGroups,
  canAuthor,
  canModerate,
  canGrantRoles,
  canEditPost,
} from '@/lib/roles';

describe('roleFromGroups', () => {
  it('picks the highest-privilege group', () => {
    expect(roleFromGroups(['ContentWriter', 'SystemAdmin'])).toBe('SYSTEM_ADMIN');
    expect(roleFromGroups(['ContentAdmin'])).toBe('CONTENT_ADMIN');
    expect(roleFromGroups(['ContentWriter'])).toBe('CONTENT_WRITER');
    expect(roleFromGroups([])).toBe('READER');
  });
});

describe('capability helpers', () => {
  it('authoring requires writer or above', () => {
    expect(canAuthor('READER')).toBe(false);
    expect(canAuthor('CONTENT_WRITER')).toBe(true);
    expect(canAuthor('SYSTEM_ADMIN')).toBe(true);
  });
  it('moderation requires admin or above', () => {
    expect(canModerate('CONTENT_WRITER')).toBe(false);
    expect(canModerate('CONTENT_ADMIN')).toBe(true);
  });
  it('only system admins grant roles', () => {
    expect(canGrantRoles('CONTENT_ADMIN')).toBe(false);
    expect(canGrantRoles('SYSTEM_ADMIN')).toBe(true);
  });
});

describe('canEditPost', () => {
  const post = { authorId: 'u1' };
  it('writers edit only their own posts', () => {
    expect(canEditPost('CONTENT_WRITER', 'u1', post)).toBe(true);
    expect(canEditPost('CONTENT_WRITER', 'u2', post)).toBe(false);
  });
  it('admins edit any post', () => {
    expect(canEditPost('CONTENT_ADMIN', 'u2', post)).toBe(true);
  });
  it('readers edit nothing', () => {
    expect(canEditPost('READER', 'u1', post)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/roles.test.ts`
Expected: FAIL — cannot resolve `@/lib/roles`.

- [ ] **Step 3: Write `src/lib/roles.ts`**

```ts
export type Role = 'READER' | 'CONTENT_WRITER' | 'CONTENT_ADMIN' | 'SYSTEM_ADMIN';

export const ROLE_TO_GROUP: Record<Role, string | null> = {
  READER: null,
  CONTENT_WRITER: 'ContentWriter',
  CONTENT_ADMIN: 'ContentAdmin',
  SYSTEM_ADMIN: 'SystemAdmin',
};

export const ASSIGNABLE_ROLES: Role[] = [
  'READER',
  'CONTENT_WRITER',
  'CONTENT_ADMIN',
  'SYSTEM_ADMIN',
];

export function roleFromGroups(groups: string[]): Role {
  if (groups.includes('SystemAdmin')) return 'SYSTEM_ADMIN';
  if (groups.includes('ContentAdmin')) return 'CONTENT_ADMIN';
  if (groups.includes('ContentWriter')) return 'CONTENT_WRITER';
  return 'READER';
}

export function canAuthor(role: Role): boolean {
  return role === 'CONTENT_WRITER' || role === 'CONTENT_ADMIN' || role === 'SYSTEM_ADMIN';
}

export function canModerate(role: Role): boolean {
  return role === 'CONTENT_ADMIN' || role === 'SYSTEM_ADMIN';
}

export function canGrantRoles(role: Role): boolean {
  return role === 'SYSTEM_ADMIN';
}

export function canEditPost(
  role: Role,
  userId: string,
  post: { authorId: string },
): boolean {
  if (canModerate(role)) return true;
  if (role === 'CONTENT_WRITER') return post.authorId === userId;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add role derivation and permission helpers"
```

---

## Task 6: Pure-logic library — sanitize schema & soft-delete filters (TDD)

**Files:**
- Create: `tests/sanitize.test.ts`, `src/lib/sanitize.ts`, `tests/posts.test.ts`, `src/lib/posts.ts`

- [ ] **Step 1: Write the failing tests**

`tests/sanitize.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { markdownSanitizeSchema } from '@/lib/sanitize';

describe('markdownSanitizeSchema', () => {
  it('allows media tags for embeds', () => {
    expect(markdownSanitizeSchema.tagNames).toContain('img');
    expect(markdownSanitizeSchema.tagNames).toContain('video');
    expect(markdownSanitizeSchema.tagNames).toContain('iframe');
  });
  it('does not allow script', () => {
    expect(markdownSanitizeSchema.tagNames).not.toContain('script');
  });
  it('permits src/controls on video', () => {
    expect(markdownSanitizeSchema.attributes!.video).toContain('controls');
  });
});
```

`tests/posts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { publishedOnly, notDeleted } from '@/lib/posts';

const rows = [
  { id: '1', status: 'PUBLISHED' },
  { id: '2', status: 'DRAFT' },
  { id: '3', status: 'DELETED' },
];

describe('soft-delete filters', () => {
  it('publishedOnly keeps only PUBLISHED', () => {
    expect(publishedOnly(rows).map((r) => r.id)).toEqual(['1']);
  });
  it('notDeleted drops only DELETED', () => {
    expect(notDeleted(rows).map((r) => r.id)).toEqual(['1', '2']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sanitize.test.ts tests/posts.test.ts`
Expected: FAIL — modules unresolved.

- [ ] **Step 3: Write `src/lib/sanitize.ts`**

```ts
import { defaultSchema } from 'rehype-sanitize';

export const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'img',
    'video',
    'source',
    'iframe',
  ],
  attributes: {
    ...defaultSchema.attributes,
    img: ['src', 'alt', 'title', 'width', 'height'],
    video: ['src', 'controls', 'width', 'height', 'poster'],
    source: ['src', 'type'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https'],
  },
};
```

- [ ] **Step 4: Write `src/lib/posts.ts`**

```ts
export interface HasStatus {
  status?: string | null;
}

export function publishedOnly<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'PUBLISHED');
}

export function notDeleted<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status !== 'DELETED');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/sanitize.test.ts tests/posts.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all 5 test files pass.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add markdown sanitize schema and soft-delete filters"
```

---

## Task 7: Amplify backend — auth resource + seed-admin trigger

**Files:**
- Create: `amplify/auth/resource.ts`, `amplify/auth/post-confirmation/resource.ts`, `amplify/auth/post-confirmation/handler.ts`

- [ ] **Step 1: Create `amplify/auth/post-confirmation/resource.ts`**

```ts
import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  environment: {
    // Comma-separated emails auto-promoted to SystemAdmin on sign-up.
    SEED_ADMIN_EMAILS: process.env.SEED_ADMIN_EMAILS ?? '',
  },
});
```

- [ ] **Step 2: Create `amplify/auth/post-confirmation/handler.ts`**

```ts
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
```

- [ ] **Step 3: Create `amplify/auth/resource.ts`**

```ts
import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: { email: true },
  groups: ['SystemAdmin', 'ContentAdmin', 'ContentWriter'],
  triggers: { postConfirmation },
  access: (allow) => [
    allow.resource(postConfirmation).to(['addUserToGroup']),
  ],
});
```

- [ ] **Step 4: Commit** (backend compiles once Task 9 wires `backend.ts`; commit the resource now)

```bash
git add -A && git commit -m "feat(amplify): add Cognito auth with groups and seed-admin trigger"
```

---

## Task 8: Amplify backend — data schema + storage + role function

**Files:**
- Create: `amplify/data/resource.ts`, `amplify/storage/resource.ts`, `amplify/functions/set-user-role/resource.ts`, `amplify/functions/set-user-role/handler.ts`

- [ ] **Step 1: Create `amplify/functions/set-user-role/resource.ts`**

```ts
import { defineFunction } from '@aws-amplify/backend';

export const setUserRole = defineFunction({
  name: 'set-user-role',
});
```

- [ ] **Step 2: Create `amplify/functions/set-user-role/handler.ts`**

```ts
import type { Schema } from '../../data/resource';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();
const MANAGED_GROUPS = ['ContentWriter', 'ContentAdmin', 'SystemAdmin'];
const ROLE_TO_GROUP: Record<string, string | null> = {
  READER: null,
  CONTENT_WRITER: 'ContentWriter',
  CONTENT_ADMIN: 'ContentAdmin',
  SYSTEM_ADMIN: 'SystemAdmin',
};

export const handler: Schema['setUserRole']['functionHandler'] = async (event) => {
  const { userId, role } = event.arguments;
  const userPoolId = process.env.USER_POOL_ID as string;
  const target = ROLE_TO_GROUP[role as string];

  // Remove from every managed group first so role changes are idempotent.
  for (const group of MANAGED_GROUPS) {
    await client
      .send(
        new AdminRemoveUserFromGroupCommand({
          GroupName: group,
          Username: userId as string,
          UserPoolId: userPoolId,
        }),
      )
      .catch(() => undefined);
  }

  if (target) {
    await client.send(
      new AdminAddUserToGroupCommand({
        GroupName: target,
        Username: userId as string,
        UserPoolId: userPoolId,
      }),
    );
  }

  return JSON.stringify({ userId, role });
};
```

- [ ] **Step 3: Create `amplify/data/resource.ts`**

```ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { setUserRole } from '../functions/set-user-role/resource';

const schema = a.schema({
  UserProfile: a
    .model({
      email: a.string().required(),
      displayName: a.string(),
      role: a.enum(['READER', 'CONTENT_WRITER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN']),
      status: a.enum(['ACTIVE', 'DELETED']),
    })
    .authorization((allow) => [
      allow.owner().to(['read', 'create', 'update']),
      allow.groups(['SystemAdmin']).to(['read', 'update']),
    ]),

  Post: a
    .model({
      slug: a.string().required(),
      title: a.string().required(),
      bodyMarkdown: a.string().required(),
      excerpt: a.string(),
      coverImageKey: a.string(),
      tags: a.string().array(),
      status: a.enum(['DRAFT', 'PUBLISHED', 'DELETED']),
      authorId: a.string().required(),
      authorName: a.string(),
      publishedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['read']),
      allow.groups(['ContentWriter', 'ContentAdmin', 'SystemAdmin']).to([
        'create',
        'read',
        'update',
      ]),
    ]),

  Comment: a
    .model({
      postId: a.id().required(),
      body: a.string().required(),
      authorId: a.string().required(),
      authorName: a.string(),
      status: a.enum(['ACTIVE', 'DELETED']),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['read', 'create']),
      allow.owner().to(['read', 'create', 'update']),
      allow.groups(['ContentAdmin', 'SystemAdmin']).to(['read', 'update']),
    ]),

  setUserRole: a
    .mutation()
    .arguments({ userId: a.string().required(), role: a.string().required() })
    .returns(a.json())
    .authorization((allow) => [allow.groups(['SystemAdmin'])])
    .handler(a.handler.function(setUserRole)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
```

> No model grants `delete` → hard-delete is impossible via the API. "Delete" is an
> `update` setting `status: 'DELETED'`.

- [ ] **Step 4: Create `amplify/storage/resource.ts`**

```ts
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
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(amplify): add data schema, storage, and role-assign function"
```

---

## Task 9: Amplify backend — wire `backend.ts` and start sandbox

**Files:**
- Create: `amplify/backend.ts`, `amplify/package.json`, `amplify/tsconfig.json`

- [ ] **Step 1: Create `amplify/package.json`** (marks the backend as ESM)

```json
{
  "type": "module"
}
```

- [ ] **Step 2: Create `amplify/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "paths": { "$amplify/*": ["../.amplify/generated/*"] }
  }
}
```

- [ ] **Step 3: Create `amplify/backend.ts`**

```ts
import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { setUserRole } from './functions/set-user-role/resource';

const backend = defineBackend({ auth, data, storage, setUserRole });

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
```

- [ ] **Step 4: Launch the sandbox to provision the backend**

Run (requires AWS credentials in the environment; keep it running in a separate terminal):
```bash
SEED_ADMIN_EMAILS="rajendra.venkata@gmail.com" npx ampx sandbox --once
```
Expected: deploys auth/data/storage/functions and writes `amplify_outputs.json` to the repo root. If no AWS credentials are configured, stop here and tell the user — the rest of the plan needs `amplify_outputs.json`.

- [ ] **Step 5: Verify outputs exist**

Run: `test -f amplify_outputs.json && echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit** (outputs are gitignored; commit the backend wiring)

```bash
git add -A && git commit -m "feat(amplify): wire backend with Cognito IAM grants for role function"
```

---

## Task 10: Frontend plumbing — Amplify config, data client, current-user hook

**Files:**
- Create: `src/components/ConfigureAmplify.tsx`, `src/lib/client.ts`, `src/lib/useCurrentUser.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/ConfigureAmplify.tsx`**

```tsx
'use client';

import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

Amplify.configure(outputs, { ssr: true });

export default function ConfigureAmplify() {
  return null;
}
```

- [ ] **Step 2: Create `src/lib/client.ts`**

```ts
'use client';

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

export const client = generateClient<Schema>();
```

- [ ] **Step 3: Create `src/lib/useCurrentUser.ts`**

```ts
'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { roleFromGroups, type Role } from '@/lib/roles';

export interface CurrentUser {
  userId: string;
  username: string;
  email: string;
  role: Role;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const current = await getCurrentUser();
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload ?? {};
      const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];
      const email = (payload.email as string | undefined) ?? '';
      setUser({
        userId: current.userId,
        username: current.username,
        email,
        role: roleFromGroups(groups),
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const stop = Hub.listen('auth', () => load());
    return () => stop();
  }, []);

  return { user, loading, reload: load };
}
```

- [ ] **Step 4: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';
import '@aws-amplify/ui-react/styles.css';
import ConfigureAmplify from '@/components/ConfigureAmplify';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'MNNR AI Blogs',
  description: 'Role-based blogging on AWS Amplify',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <ConfigureAmplify />
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create a placeholder `src/components/Nav.tsx`** (full version in Task 11)

```tsx
'use client';

import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="border-b px-4 py-3">
      <Link href="/" className="font-semibold">MNNR AI Blogs</Link>
    </nav>
  );
}
```

- [ ] **Step 6: Verify the app compiles**

Run: `npm run build`
Expected: build succeeds (pages may be near-empty — that's fine).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): add Amplify config, data client, and current-user hook"
```

---

## Task 11: Auth pages + role-aware nav + route guard

**Files:**
- Create: `src/app/auth/page.tsx`, `src/components/RequireRole.tsx`
- Modify: `src/components/Nav.tsx`

- [ ] **Step 1: Create `src/app/auth/page.tsx`**

```tsx
'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthPage() {
  const router = useRouter();
  return (
    <Authenticator signUpAttributes={['email']}>
      {({ user }) => <Redirect ready={!!user} onReady={() => router.push('/account')} />}
    </Authenticator>
  );
}

function Redirect({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);
  return <p className="py-8">Signed in. Redirecting…</p>;
}
```

- [ ] **Step 2: Create `src/components/RequireRole.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/lib/useCurrentUser';
import type { Role } from '@/lib/roles';

export default function RequireRole({
  allow,
  children,
}: {
  allow: (role: Role) => boolean;
  children: React.ReactNode;
}) {
  const { user, loading } = useCurrentUser();
  if (loading) return <p className="py-8">Loading…</p>;
  if (!user) {
    return (
      <p className="py-8">
        Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.
      </p>
    );
  }
  if (!allow(user.role)) {
    return <p className="py-8">You don’t have access to this page.</p>;
  }
  return <>{children}</>;
}
```

- [ ] **Step 3: Replace `src/components/Nav.tsx` with the role-aware version**

```tsx
'use client';

import Link from 'next/link';
import { signOut } from 'aws-amplify/auth';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canGrantRoles } from '@/lib/roles';

export default function Nav() {
  const { user } = useCurrentUser();
  return (
    <nav className="flex items-center gap-4 border-b px-4 py-3 text-sm">
      <Link href="/" className="font-semibold">MNNR AI Blogs</Link>
      <span className="flex-1" />
      {user && canAuthor(user.role) && <Link href="/studio">Studio</Link>}
      {user && canGrantRoles(user.role) && <Link href="/admin">Admin</Link>}
      {user ? (
        <>
          <Link href="/account">{user.email || 'Account'}</Link>
          <button onClick={() => signOut()} className="text-gray-600">Sign out</button>
        </>
      ) : (
        <Link href="/auth">Sign in</Link>
      )}
    </nav>
  );
}
```

- [ ] **Step 4: Verify in the sandbox**

With the sandbox running (`npx ampx sandbox`) and `npm run dev`, open `/auth`, register with the seed email, confirm via the emailed code. Expected: after sign-in you land on `/account`; the nav shows Studio + Admin (seed email is auto-promoted to SystemAdmin).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add auth page, role-aware nav, and route guard"
```

---

## Task 12: Markdown renderer + share buttons + comments

**Files:**
- Create: `src/components/MarkdownView.tsx`, `src/components/ShareButtons.tsx`, `src/components/Comments.tsx`

- [ ] **Step 1: Create `src/components/MarkdownView.tsx`**

```tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '@/lib/sanitize';

export default function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="prose max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ShareButtons.tsx`**

```tsx
'use client';

import { linkedInShareUrl, xShareUrl, facebookShareUrl } from '@/lib/share';

export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const payload = { url, title };
  const links = [
    { label: 'LinkedIn', href: linkedInShareUrl(payload) },
    { label: 'X', href: xShareUrl(payload) },
    { label: 'Facebook', href: facebookShareUrl(payload) },
  ];
  return (
    <div className="flex gap-3 py-4 text-sm">
      <span className="text-gray-500">Share:</span>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
           className="text-blue-600 underline">
          {l.label}
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/Comments.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canModerate } from '@/lib/roles';
import { notDeleted } from '@/lib/posts';

interface CommentRow {
  id: string;
  body: string;
  authorId: string;
  authorName?: string | null;
  status?: string | null;
}

export default function Comments({ postId }: { postId: string }) {
  const { user } = useCurrentUser();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState('');

  async function load() {
    const { data } = await client.models.Comment.list({
      filter: { postId: { eq: postId } },
      authMode: 'apiKey',
    });
    setComments(notDeleted(data as CommentRow[]));
  }

  useEffect(() => {
    load();
  }, [postId]);

  async function add() {
    if (!user || !body.trim()) return;
    await client.models.Comment.create({
      postId,
      body: body.trim(),
      authorId: user.userId,
      authorName: user.email,
      status: 'ACTIVE',
    });
    setBody('');
    load();
  }

  async function softDelete(id: string) {
    await client.models.Comment.update({ id, status: 'DELETED' });
    load();
  }

  return (
    <section className="border-t pt-6">
      <h2 className="mb-3 text-lg font-semibold">Comments</h2>
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{c.authorName ?? 'Anonymous'}</div>
            <div>{c.body}</div>
            {user && (canModerate(user.role) || user.userId === c.authorId) && (
              <button onClick={() => softDelete(c.id)} className="mt-1 text-xs text-red-600">
                Delete
              </button>
            )}
          </li>
        ))}
        {comments.length === 0 && <li className="text-sm text-gray-500">No comments yet.</li>}
      </ul>
      {user ? (
        <div className="mt-4 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded border p-2 text-sm"
            placeholder="Write a comment…"
          />
          <button onClick={add} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
            Post comment
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Sign in to comment.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Verify compile**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add markdown renderer, share buttons, and comments"
```

---

## Task 13: Public feed + post detail pages

**Files:**
- Create: `src/app/posts/[slug]/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx` (public feed)**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  status?: string | null;
  publishedAt?: string | null;
}

export default function Home() {
  const [posts, setPosts] = useState<PostRow[]>([]);

  useEffect(() => {
    client.models.Post.list({ authMode: 'apiKey' }).then(({ data }) => {
      const visible = publishedOnly(data as PostRow[]).sort((a, b) =>
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
      setPosts(visible);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Latest posts</h1>
      {posts.map((p) => (
        <article key={p.id} className="border-b pb-4">
          <Link href={`/posts/${p.slug}`} className="text-xl font-semibold text-blue-700">
            {p.title}
          </Link>
          {p.excerpt && <p className="text-gray-600">{p.excerpt}</p>}
        </article>
      ))}
      {posts.length === 0 && <p className="text-gray-500">No posts published yet.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/posts/[slug]/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';
import MarkdownView from '@/components/MarkdownView';
import ShareButtons from '@/components/ShareButtons';
import Comments from '@/components/Comments';

interface PostRow {
  id: string;
  slug: string;
  title: string;
  bodyMarkdown: string;
  status?: string | null;
  authorName?: string | null;
}

export default function PostDetail() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    client.models.Post.list({
      filter: { slug: { eq: params.slug } },
      authMode: 'apiKey',
    }).then(({ data }) => {
      const match = publishedOnly(data as PostRow[])[0];
      if (match) setPost(match);
      else setNotFound(true);
    });
  }, [params.slug]);

  if (notFound) return <p className="py-8">Post not found.</p>;
  if (!post) return <p className="py-8">Loading…</p>;

  const url = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <article className="space-y-2">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      {post.authorName && <p className="text-sm text-gray-500">By {post.authorName}</p>}
      <ShareButtons url={url} title={post.title} />
      <MarkdownView markdown={post.bodyMarkdown} />
      <div className="pt-8">
        <Comments postId={post.id} />
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Verify in sandbox**

With sandbox + `npm run dev`, after creating a published post (Task 14) the feed lists it and `/posts/<slug>` renders body, share buttons, and comments. (Until Task 14 there are no posts — verify the empty states render.)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): add public feed and post detail pages"
```

---

## Task 14: Studio — dashboard, editor, create/edit pages

**Files:**
- Create: `src/components/PostEditor.tsx`, `src/app/studio/page.tsx`, `src/app/studio/posts/new/page.tsx`, `src/app/studio/posts/[id]/edit/page.tsx`

- [ ] **Step 1: Create `src/components/PostEditor.tsx`** (markdown editor + S3 media upload)

```tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { uploadData, getUrl } from 'aws-amplify/storage';
import '@uiw/react-md-editor/markdown-editor.css';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

export interface PostDraft {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  status: 'DRAFT' | 'PUBLISHED';
}

export default function PostEditor({
  initial,
  onSave,
}: {
  initial: PostDraft;
  onSave: (draft: PostDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PostDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const key = `media/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      await uploadData({ path: key, data: file }).result;
      const { url } = await getUrl({ path: key });
      const isVideo = file.type.startsWith('video/');
      const snippet = isVideo
        ? `\n<video src="${url.toString()}" controls width="100%"></video>\n`
        : `\n![${file.name}](${url.toString()})\n`;
      setDraft((d) => ({ ...d, bodyMarkdown: d.bodyMarkdown + snippet }));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded border p-2 text-lg"
        placeholder="Title"
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      <input
        className="w-full rounded border p-2"
        placeholder="Excerpt"
        value={draft.excerpt}
        onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
      />
      <label className="block text-sm">
        Upload image/video:{' '}
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading && <span className="ml-2 text-gray-500">Uploading…</span>}
      </label>
      <div data-color-mode="light">
        <MDEditor
          height={400}
          value={draft.bodyMarkdown}
          onChange={(v) => setDraft({ ...draft, bodyMarkdown: v ?? '' })}
        />
      </div>
      <div className="flex items-center gap-3">
        <select
          className="rounded border p-2"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value as PostDraft['status'] })}
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/studio/page.tsx`** (dashboard listing posts)

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RequireRole from '@/components/RequireRole';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canModerate, canEditPost } from '@/lib/roles';
import { notDeleted } from '@/lib/posts';

interface PostRow {
  id: string;
  title: string;
  slug: string;
  status?: string | null;
  authorId: string;
}

export default function StudioPage() {
  return (
    <RequireRole allow={canAuthor}>
      <StudioInner />
    </RequireRole>
  );
}

function StudioInner() {
  const { user } = useCurrentUser();
  const [posts, setPosts] = useState<PostRow[]>([]);

  async function load() {
    const { data } = await client.models.Post.list({});
    let rows = notDeleted(data as PostRow[]);
    if (user && !canModerate(user.role)) {
      rows = rows.filter((p) => p.authorId === user.userId);
    }
    setPosts(rows);
  }

  useEffect(() => {
    if (user) load();
  }, [user?.userId]);

  async function softDelete(id: string) {
    await client.models.Post.update({ id, status: 'DELETED' });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Studio</h1>
        <Link href="/studio/posts/new" className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
          New post
        </Link>
      </div>
      <ul className="divide-y">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <span>
              {p.title} <span className="text-xs text-gray-500">({p.status})</span>
            </span>
            <span className="flex gap-3 text-sm">
              {user && canEditPost(user.role, user.userId, p) && (
                <Link href={`/studio/posts/${p.id}/edit`} className="text-blue-600">Edit</Link>
              )}
              {user && canEditPost(user.role, user.userId, p) && (
                <button onClick={() => softDelete(p.id)} className="text-red-600">Delete</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/studio/posts/new/page.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import PostEditor, { type PostDraft } from '@/components/PostEditor';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor } from '@/lib/roles';
import { uniqueSlug } from '@/lib/slug';

export default function NewPostPage() {
  return (
    <RequireRole allow={canAuthor}>
      <NewPostInner />
    </RequireRole>
  );
}

function NewPostInner() {
  const router = useRouter();
  const { user } = useCurrentUser();

  async function save(draft: PostDraft) {
    if (!user) return;
    const { data: existing } = await client.models.Post.list({});
    const slugs = (existing ?? []).map((p) => p.slug);
    const slug = uniqueSlug(draft.title, slugs);
    await client.models.Post.create({
      ...draft,
      slug,
      authorId: user.userId,
      authorName: user.email,
      publishedAt: draft.status === 'PUBLISHED' ? new Date().toISOString() : null,
    });
    router.push('/studio');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New post</h1>
      <PostEditor
        initial={{ title: '', excerpt: '', bodyMarkdown: '', status: 'DRAFT' }}
        onSave={save}
      />
    </div>
  );
}
```

> `new Date().toISOString()` runs in the browser at click time — fine for the
> frontend. (The Date restriction only applies to Workflow scripts, not app code.)

- [ ] **Step 4: Create `src/app/studio/posts/[id]/edit/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import PostEditor, { type PostDraft } from '@/components/PostEditor';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canEditPost } from '@/lib/roles';

export default function EditPostPage() {
  return (
    <RequireRole allow={canAuthor}>
      <EditPostInner />
    </RequireRole>
  );
}

function EditPostInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    client.models.Post.get({ id: params.id }).then(({ data }) => {
      if (!data || !user) return;
      if (!canEditPost(user.role, user.userId, data)) {
        setDenied(true);
        return;
      }
      setDraft({
        title: data.title,
        excerpt: data.excerpt ?? '',
        bodyMarkdown: data.bodyMarkdown,
        status: (data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'),
      });
    });
  }, [params.id, user?.userId]);

  async function save(next: PostDraft) {
    await client.models.Post.update({
      id: params.id,
      title: next.title,
      excerpt: next.excerpt,
      bodyMarkdown: next.bodyMarkdown,
      status: next.status,
      publishedAt: next.status === 'PUBLISHED' ? new Date().toISOString() : null,
    });
    router.push('/studio');
  }

  if (denied) return <p className="py-8">You can’t edit this post.</p>;
  if (!draft) return <p className="py-8">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit post</h1>
      <PostEditor initial={draft} onSave={save} />
    </div>
  );
}
```

- [ ] **Step 5: Verify end-to-end in sandbox**

As the seed SystemAdmin: create a post, upload an image (appears in body), publish, confirm it shows on `/` and `/posts/<slug>` with the image rendered. Delete it from Studio → it disappears from the feed but the DynamoDB record still exists with `status=DELETED` (verify in the AWS console DynamoDB table).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): add studio dashboard, editor, and create/edit pages"
```

---

## Task 15: Account page + Admin role-assignment screen

**Files:**
- Create: `src/app/account/page.tsx`, `src/app/admin/page.tsx`

- [ ] **Step 1: Create `src/app/account/page.tsx`**

```tsx
'use client';

import { useCurrentUser } from '@/lib/useCurrentUser';
import Link from 'next/link';

export default function AccountPage() {
  const { user, loading } = useCurrentUser();
  if (loading) return <p className="py-8">Loading…</p>;
  if (!user) {
    return (
      <p className="py-8">
        Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <p className="text-sm text-gray-500">
        Need writer access? Ask a system admin to grant it. (Self-service requests
        arrive in Phase 2.)
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/page.tsx`** (SystemAdmin assigns roles)

```tsx
'use client';

import { useState } from 'react';
import RequireRole from '@/components/RequireRole';
import { client } from '@/lib/client';
import { canGrantRoles, ASSIGNABLE_ROLES, type Role } from '@/lib/roles';

export default function AdminPage() {
  return (
    <RequireRole allow={canGrantRoles}>
      <AdminInner />
    </RequireRole>
  );
}

function AdminInner() {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role>('CONTENT_WRITER');
  const [message, setMessage] = useState('');

  async function assign() {
    setMessage('Working…');
    try {
      await client.mutations.setUserRole({ userId, role });
      setMessage(`Set ${userId} to ${role}.`);
    } catch (err) {
      setMessage(`Failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin — assign roles</h1>
      <p className="text-sm text-gray-600">
        Enter the user’s Cognito username (their <code>sub</code> / user id) and pick a role.
        Roles map to Cognito groups; choosing Reader removes all elevated groups.
      </p>
      <input
        className="w-full rounded border p-2"
        placeholder="Cognito username / user id"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />
      <select
        className="rounded border p-2"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button onClick={assign} className="rounded bg-blue-600 px-4 py-2 text-white">
        Assign role
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Verify in sandbox**

As the seed SystemAdmin, open `/admin`, enter a second test user's id, set `CONTENT_WRITER`, submit → success message. That user signs out/in and now sees Studio. (Cognito group changes apply on the next token refresh / re-login.)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): add account page and admin role-assignment screen"
```

---

## Task 16: README, final build, full test run

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
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
````

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all unit tests pass.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: add README and finalize Phase 1"
```

---

## Self-review — spec coverage

| Spec requirement | Covered by |
|---|---|
| NextJS site | Tasks 1, 10–15 |
| Runs on AWS Amplify | Tasks 7–9 (Gen 2 backend), README deploy note |
| Only writers author; role-based | Data auth (Task 8) + `canAuthor`/`canEditPost` (Task 5) + guards (Task 11/14) |
| Markdown authoring | `PostEditor` + `MarkdownView` (Tasks 12, 14) |
| Embed images/video | S3 upload in `PostEditor` + sanitize schema (Tasks 6, 14) |
| Users register, login, comment | Auth page (11) + `Comments` (12) |
| Request content access | Phase 2 (noted on `/account`); minimal admin grant in Task 15 |
| Content stored in DynamoDB | Amplify Data schema (Task 8) |
| Soft-delete, never hard-delete | No `delete` granted; status=DELETED (Tasks 8, 12, 14) |
| Cognito for registration | Task 7 |
| System admin grants access, multiple, controlled outside normal flow | Seed-email bootstrap (Task 7) + `/admin` + `setUserRole` (Tasks 8, 15) |
| Share to LinkedIn/X/Facebook | `share.ts` + `ShareButtons` (Tasks 4, 12) |

**Deferred to Phase 2 (per approved spec):** self-service `AccessRequest` workflow, full admin console with the request queue, SSR + OpenGraph meta for richer share previews.
