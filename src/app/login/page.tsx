'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import AuthCard, { authInputClass, authButtonClass, AuthDivider } from '@/components/AuthCard';
import GoogleButton from '@/components/GoogleButton';
import { authErrorMessage } from '@/lib/authErrors';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doSignIn() {
    setBusy(true);
    setError('');
    try {
      const res = await signIn({ username: email, password });
      if (res.isSignedIn) {
        router.push('/account');
      } else if (res.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        await resendSignUpCode({ username: email }).catch(() => undefined);
        setNeedsConfirm(true);
      } else {
        setError('Sign-in needs an additional step that is not supported here.');
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'UserNotConfirmedException') {
        await resendSignUpCode({ username: email }).catch(() => undefined);
        setNeedsConfirm(true);
      } else {
        setError(authErrorMessage(err));
      }
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

  if (needsConfirm) {
    return (
      <AuthCard title="Confirm your email" subtitle={`Enter the code sent to ${email}`}>
        <form onSubmit={(e) => { e.preventDefault(); doConfirm(); }} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Confirmation code</label>
            <input className={authInputClass} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className={authButtonClass}>{busy ? 'Confirming…' : 'Confirm and sign in'}</button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign in to MNMR AI Blogs"
      subtitle="Enter your credentials to access your account"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">Register</Link>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); doSignIn(); }} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input type="email" className={authInputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <Link href="/forgot" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <input type="password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className={authButtonClass}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <AuthDivider />
      <GoogleButton />
    </AuthCard>
  );
}
