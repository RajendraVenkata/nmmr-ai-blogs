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
