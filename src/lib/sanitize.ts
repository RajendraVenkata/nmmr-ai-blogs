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
