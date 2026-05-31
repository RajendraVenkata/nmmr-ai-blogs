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
