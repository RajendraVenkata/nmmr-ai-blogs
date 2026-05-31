'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp, confirmSignUp, signIn } from 'aws-amplify/auth';
import AuthCard, { authInputClass, authButtonClass } from '@/components/AuthCard';
import { authErrorMessage } from '@/lib/authErrors';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'form' | 'confirm'>('form');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doRegister() {
    setBusy(true);
    setError('');
    try {
      const res = await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      if (res.isSignUpComplete) {
        await signIn({ username: email, password });
        router.push('/account');
      } else {
        setStage('confirm');
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function doConfirm() {
    setBusy(true);
    setError('');
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      await signIn({ username: email, password });
      router.push('/account');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'confirm') {
    return (
      <AuthCard title="Confirm your email" subtitle={`Enter the code sent to ${email}`}>
        <form onSubmit={(e) => { e.preventDefault(); doConfirm(); }} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Confirmation code</label>
            <input className={authInputClass} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className={authButtonClass}>{busy ? 'Confirming…' : 'Confirm and continue'}</button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join MNMR AI Blogs"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); doRegister(); }} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input type="email" className={authInputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Password</label>
          <input type="password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className={authButtonClass}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
    </AuthCard>
  );
}
