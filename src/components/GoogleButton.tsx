'use client';

import { useState } from 'react';
import { signInWithRedirect } from 'aws-amplify/auth';

export default function GoogleButton() {
  const [msg, setMsg] = useState('');

  async function handleClick() {
    setMsg('');
    try {
      await signInWithRedirect({ provider: 'Google' });
    } catch {
      setMsg('Could not start Google sign-in. Please try again.');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <svg width="16" height="16" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.6 13.2l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v7.4h12.4c-.3 2-1.6 5-4.6 7l7.1 5.5c4.2-3.9 6.7-9.6 6.7-15.8z" />
          <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.8l7.8-6.5z" />
          <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.1-5.5c-2 1.3-4.6 2.3-8.1 2.3-6.4 0-11.8-3.7-13.6-9.8l-7.8 6.5C6.4 42.6 14.6 48 24 48z" />
        </svg>
        Continue with Google
      </button>
      {msg && <p className="mt-2 text-center text-xs text-red-600">{msg}</p>}
    </div>
  );
}
