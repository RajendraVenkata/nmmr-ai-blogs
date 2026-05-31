import type { Metadata } from 'next';
import './globals.css';
import ConfigureAmplify from '@/components/ConfigureAmplify';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'MNMR AI Blogs',
  description: 'Hands-on insights on AI and engineering',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-gray-900 antialiased">
        <ConfigureAmplify />
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
