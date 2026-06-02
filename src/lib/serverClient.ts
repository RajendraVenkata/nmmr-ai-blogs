import { cache } from 'react';
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { generateServerClientUsingReqRes } from '@aws-amplify/adapter-nextjs/data';
import outputs from '../../amplify_outputs.json';
import type { Schema } from '../../amplify/data/resource';
import { publishedOnly, type PostRow } from './posts';

const { runWithAmplifyServerContext } = createServerRunner({
  config: outputs,
});

const serverClient = generateServerClientUsingReqRes<Schema>({
  config: outputs,
});

// React cache dedupes the query within a single request (generateMetadata + page).
export const getPublishedPostBySlug = cache(
  async (slug: string): Promise<PostRow | null> => {
    const { data } = await runWithAmplifyServerContext({
      nextServerContext: null,
      operation: (contextSpec) =>
        serverClient.models.Post.list(contextSpec, {
          filter: { slug: { eq: slug } },
          authMode: 'apiKey',
        }),
    });
    return publishedOnly(data as PostRow[])[0] ?? null;
  },
);
