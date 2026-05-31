'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';

export default function AuthPage() {
  const router = useRouter();
  const onReady = useCallback(() => router.push('/account'), [router]);
  return (
    <Authenticator signUpAttributes={['email']}>
      {({ user }) => <Redirect ready={!!user} onReady={onReady} />}
    </Authenticator>
  );
}

function Redirect({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);
  return <p className="py-8">Signed in. Redirecting…</p>;
}
