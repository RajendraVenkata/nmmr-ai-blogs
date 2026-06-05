'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '@/lib/sanitize';
import dynamic from 'next/dynamic';
import { parseTerminalFence } from '@/lib/terminalEmbed';

const TerminalEmbed = dynamic(() => import('@/components/TerminalEmbed'), { ssr: false });
const FloatingTerminal = dynamic(() => import('@/components/FloatingTerminal'), { ssr: false });

export default function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="prose max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        components={{
          code({ className, children, ...props }) {
            const lang = /language-(\w+)/.exec(className || '')?.[1];
            const parsed = parseTerminalFence(lang, String(children));
            if (parsed) {
              return parsed.float
                ? <FloatingTerminal labId={parsed.labId} />
                : <TerminalEmbed labId={parsed.labId} />;
            }
            return <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
