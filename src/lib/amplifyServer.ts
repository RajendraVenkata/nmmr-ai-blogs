import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { getUrl } from 'aws-amplify/storage/server';
import outputs from '../../amplify_outputs.json';

export const { runWithAmplifyServerContext } = createServerRunner({
  config: outputs,
});

// Mints a short-lived signed URL for a media object using guest credentials
// (media/* allows guest read). Regenerated per render, so re-scrapes get a fresh URL.
export async function getSignedMediaUrl(key: string): Promise<string> {
  const { url } = await runWithAmplifyServerContext({
    nextServerContext: null,
    operation: (contextSpec) => getUrl(contextSpec, { path: key }),
  });
  return url.toString();
}
