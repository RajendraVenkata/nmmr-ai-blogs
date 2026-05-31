'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import AuthCard, { authInputClass, authButtonClass } from '@/components/AuthCard';
import { authErrorMessage } from '@/lib/authErrors';

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<'request' | 'confirm'>('request');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doRequest() {
    setBusy(true);
    setError('');
    try {
      await resetPassword({ username: email });
      setStage('confirm');
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
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword: password });
      router.push('/login');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle={stage === 'request' ? 'We will email you a reset code' : `Enter the code sent to ${email}`}
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
      }
    >
      {stage === 'request' ? (
        <form onSubmit={(e) => { e.preventDefault(); doRequest(); }} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input type="email" className={authInputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className={authButtonClass}>{busy ? 'Sending…' : 'Send reset code'}</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); doConfirm(); }} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Reset code</label>
            <input className={authInputClass} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">New password</label>
            <input type="password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className={authButtonClass}>{busy ? 'Saving…' : 'Set new password'}</button>
        </form>
      )}
    </AuthCard>
  );
}
