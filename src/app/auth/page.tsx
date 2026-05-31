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
