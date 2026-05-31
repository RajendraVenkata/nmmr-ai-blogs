# SaaS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the app to the light enterprise-SaaS look of nmmr.tech — light nav with Sign In / Get Started, a hero + feature cards + post card-grid home, and custom `/login`, `/register`, `/forgot` pages replacing the Amplify Authenticator.

**Architecture:** Frontend-only. Theme tokens switch to indigo `primary`. Auth is rebuilt with `aws-amplify/auth` v6 APIs behind a shared `AuthCard`. The dark-theme pieces (`ArticleCard`, `Sidebar`, `SearchContext`) are removed; the home uses a hero + feature cards + a `PostCard` grid with local search. No schema/backend change.

**Tech Stack:** Next.js 14 App Router, Tailwind (+typography), `aws-amplify` v6, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-31-saas-redesign-design.md`

**Working directory:** repo root `nmmr-ai-blogs/` (branch `saas-redesign`). Paths relative to it.

---

## File structure

```
tailwind.config.ts                 # MODIFY: add primary/primaryDark colors
src/components/CategoryChip.tsx     # MODIFY: indigo pill style
src/lib/authErrors.ts              # NEW (TDD): friendly Cognito error text
tests/authErrors.test.ts           # NEW
src/components/AuthCard.tsx         # NEW: card shell + shared input/button/divider
src/components/GoogleButton.tsx     # NEW: placeholder social button
src/app/login/page.tsx             # NEW
src/app/register/page.tsx          # NEW
src/app/forgot/page.tsx            # NEW
src/app/auth/page.tsx              # MODIFY: redirect → /login
src/components/Nav.tsx             # REPLACE: light SaaS nav
src/components/Footer.tsx           # NEW
src/app/layout.tsx                 # MODIFY: drop SearchProvider, add Footer
src/components/Hero.tsx             # NEW
src/components/FeatureCards.tsx     # NEW
src/components/PostCard.tsx         # NEW
src/app/page.tsx                   # REPLACE: hero + features + post grid
src/components/ArticleCard.tsx      # DELETE
src/components/Sidebar.tsx          # DELETE
src/lib/SearchContext.tsx          # DELETE
```

> Post detail (`src/app/posts/[slug]/page.tsx`) already uses `CategoryChip`,
> `CoverImage`, `PostMeta`, and `prose`; it needs no change beyond the chip restyle
> (Task 1) flowing through.

---

## Task 1: Theme tokens + chip restyle

**Files:**
- Modify: `tailwind.config.ts`, `src/components/CategoryChip.tsx`

- [ ] **Step 1: Replace `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#e11d2a",
        link: "#2563eb",
        primary: "#4f46e5",
        primaryDark: "#4338ca",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
```

- [ ] **Step 2: Replace `src/components/CategoryChip.tsx`** (indigo pill)

```tsx
export default function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts src/components/CategoryChip.tsx && git commit -m "feat(web): add indigo primary theme tokens and SaaS category chip"
```

---

## Task 2: Auth error helper (TDD)

**Files:**
- Create: `tests/authErrors.test.ts`, `src/lib/authErrors.ts`

- [ ] **Step 1: Write the failing test** — `tests/authErrors.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { authErrorMessage } from '@/lib/authErrors';

describe('authErrorMessage', () => {
  it('maps known Cognito error names to friendly text', () => {
    expect(authErrorMessage({ name: 'NotAuthorizedException' })).toBe('Incorrect email or password.');
    expect(authErrorMessage({ name: 'UsernameExistsException' })).toBe('An account with that email already exists.');
    expect(authErrorMessage({ name: 'CodeMismatchException' })).toBe('That confirmation code is incorrect.');
    expect(authErrorMessage({ name: 'UserNotFoundException' })).toBe('No account found with that email.');
  });
  it('falls back to the error message, then a generic string', () => {
    expect(authErrorMessage({ name: 'SomethingElse', message: 'boom' })).toBe('boom');
    expect(authErrorMessage({})).toBe('Something went wrong. Please try again.');
    expect(authErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/authErrors.test.ts`
Expected: FAIL — cannot resolve `@/lib/authErrors`.

- [ ] **Step 3: Write `src/lib/authErrors.ts`**

```ts
export function authErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'UserNotConfirmedException':
      return 'Your account is not confirmed yet. Check your email for the code.';
    case 'NotAuthorizedException':
      return 'Incorrect email or password.';
    case 'UserNotFoundException':
      return 'No account found with that email.';
    case 'UsernameExistsException':
      return 'An account with that email already exists.';
    case 'CodeMismatchException':
      return 'That confirmation code is incorrect.';
    case 'ExpiredCodeException':
      return 'That code has expired. Request a new one.';
    case 'InvalidPasswordException':
      return 'Password does not meet the requirements.';
    case 'InvalidParameterException':
      return 'Please check the information you entered.';
    case 'LimitExceededException':
      return 'Too many attempts. Please try again later.';
    default:
      return (err as { message?: string } | null)?.message || 'Something went wrong. Please try again.';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/authErrors.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/authErrors.test.ts src/lib/authErrors.ts && git commit -m "feat: add friendly auth error message helper"
```

---

## Task 3: AuthCard + Google placeholder + login page

**Files:**
- Create: `src/components/AuthCard.tsx`, `src/components/GoogleButton.tsx`, `src/app/login/page.tsx`

- [ ] **Step 1: Create `src/components/AuthCard.tsx`** (shell + shared form styles)

```tsx
import Link from 'next/link';

export const authInputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export const authButtonClass =
  'w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primaryDark disabled:opacity-60';

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
      <span className="h-px flex-1 bg-gray-200" />
      Or continue with
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-gray-900">
          MNMR AI Blogs
        </Link>
        <h1 className="text-center text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-center text-sm text-gray-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-4 text-center text-sm text-gray-600">{footer}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/GoogleButton.tsx`** (styled placeholder)

```tsx
'use client';

import { useState } from 'react';

export default function GoogleButton() {
  const [msg, setMsg] = useState('');
  return (
    <div>
      <button
        type="button"
        onClick={() => setMsg('Google sign-in is not configured yet.')}
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
      {msg && <p className="mt-2 text-center text-xs text-gray-500">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/login/page.tsx`**

```tsx
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
        router.push('/account');
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
```

- [ ] **Step 4: Build & verify**

Run: `npm run build`
Expected: compiles; `/login` present.

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthCard.tsx src/components/GoogleButton.tsx src/app/login/page.tsx && git commit -m "feat(web): custom login page with auth card and google placeholder"
```

---

## Task 4: Register + forgot pages, /auth redirect

**Files:**
- Create: `src/app/register/page.tsx`, `src/app/forgot/page.tsx`
- Modify: `src/app/auth/page.tsx`

- [ ] **Step 1: Create `src/app/register/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `src/app/forgot/page.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace `src/app/auth/page.tsx`** (redirect to /login)

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);
  return <p className="py-8 text-center text-gray-500">Redirecting…</p>;
}
```

- [ ] **Step 4: Build & verify**

Run: `npm run build`
Expected: compiles; `/register`, `/forgot`, `/auth` present.

- [ ] **Step 5: Commit**

```bash
git add src/app/register/page.tsx src/app/forgot/page.tsx src/app/auth/page.tsx && git commit -m "feat(web): custom register, forgot-password, and auth redirect"
```

---

## Task 5: Light nav + footer + layout

**Files:**
- Replace: `src/components/Nav.tsx`
- Create: `src/components/Footer.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `src/components/Nav.tsx`** (light SaaS nav)

```tsx
'use client';

import Link from 'next/link';
import { signOut } from 'aws-amplify/auth';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canGrantRoles } from '@/lib/roles';

export default function Nav() {
  const { user } = useCurrentUser();
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-gray-900">MNMR AI Blogs</Link>
          <Link href="/" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Home</Link>
          {user && canAuthor(user.role) && (
            <Link href="/studio" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Studio</Link>
          )}
          {user && canGrantRoles(user.role) && (
            <Link href="/admin" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Admin</Link>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/account" className="text-gray-600 hover:text-gray-900">{user.email || 'Account'}</Link>
              <button onClick={() => signOut()} className="text-gray-600 hover:text-gray-900">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
              <Link href="/register" className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primaryDark">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Create `src/components/Footer.tsx`**

```tsx
export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-gray-500">
        <p>© 2026 MNMR AI Blogs</p>
        <p className="mt-1">Built for sharing what we learn.</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Replace `src/app/layout.tsx`** (drop SearchProvider + ui-react css, add Footer)

```tsx
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
```

- [ ] **Step 4: Build & verify**

Run: `npm run build`
Expected: compiles. (`SearchContext.tsx` still exists and is still imported by the
old `page.tsx`/`Sidebar.tsx` — that is fine until Task 6 replaces/deletes them.)

- [ ] **Step 5: Commit**

```bash
git add src/components/Nav.tsx src/components/Footer.tsx src/app/layout.tsx && git commit -m "feat(web): light SaaS nav and footer; drop search provider"
```

---

## Task 6: Home page (hero + features + post grid)

**Files:**
- Create: `src/components/Hero.tsx`, `src/components/FeatureCards.tsx`, `src/components/PostCard.tsx`
- Replace: `src/app/page.tsx`
- Delete: `src/components/ArticleCard.tsx`, `src/components/Sidebar.tsx`, `src/lib/SearchContext.tsx`

- [ ] **Step 1: Create `src/components/Hero.tsx`**

```tsx
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="py-16 text-center">
      <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
        Hands-on insights on AI and engineering
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
        Practical articles from people building real systems.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/register" className="rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primaryDark">
          Get Started
        </Link>
        <Link href="#articles" className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50">
          Read the blog
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `src/components/FeatureCards.tsx`**

```tsx
const FEATURES = [
  { title: 'Practical guides', body: 'Step-by-step articles you can actually apply.' },
  { title: 'From practitioners', body: 'Written by people shipping real systems.' },
  { title: 'Always current', body: 'Fresh takes on AI, infrastructure, and engineering.' },
];

export default function FeatureCards() {
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {FEATURES.map((f) => (
        <div key={f.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">{f.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{f.body}</p>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Create `src/components/PostCard.tsx`**

```tsx
'use client';

import Link from 'next/link';
import CoverImage from '@/components/CoverImage';
import CategoryChip from '@/components/CategoryChip';
import PostMeta from '@/components/PostMeta';
import { categoryLabel } from '@/lib/format';

export interface PostCardData {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  tags?: (string | null)[] | null;
  coverImageKey?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
  status?: string | null;
}

export default function PostCard({ post }: { post: PostCardData }) {
  const label = categoryLabel(post.tags ?? []);
  return (
    <Link
      href={`/posts/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <CoverImage coverKey={post.coverImageKey} label={label} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <CategoryChip label={label} />
        <h3 className="text-lg font-bold leading-snug text-gray-900 group-hover:text-primary">
          {post.title}
        </h3>
        {post.excerpt && <p className="line-clamp-2 text-sm text-gray-600">{post.excerpt}</p>}
        <div className="mt-auto pt-2">
          <PostMeta authorName={post.authorName} date={post.publishedAt} />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Replace `src/app/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';
import { filterPosts } from '@/lib/format';
import Hero from '@/components/Hero';
import FeatureCards from '@/components/FeatureCards';
import PostCard, { type PostCardData } from '@/components/PostCard';

export default function Home() {
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    client.models.Post.list({ authMode: 'apiKey' }).then(({ data }) => {
      const visible = publishedOnly(data as PostCardData[]).sort((a, b) =>
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
      setPosts(visible);
    });
  }, []);

  const filtered = filterPosts(posts, query);

  return (
    <div className="space-y-12">
      <Hero />
      <FeatureCards />
      <section id="articles" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Latest articles</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64"
          />
        </div>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">
            {query ? 'No articles match your search.' : 'No articles published yet.'}
          </p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Delete the retired dark-theme files**

```bash
git rm src/components/ArticleCard.tsx src/components/Sidebar.tsx src/lib/SearchContext.tsx
```

- [ ] **Step 6: Build & verify**

Run: `npm run build`
Expected: compiles; `/` present. No remaining imports of `ArticleCard`, `Sidebar`,
or `SearchContext` (if the build errors on a missing import, grep for the symbol and
confirm it was only used by the deleted/replaced files).

- [ ] **Step 7: Commit**

```bash
git add src/components/Hero.tsx src/components/FeatureCards.tsx src/components/PostCard.tsx src/app/page.tsx && git commit -m "feat(web): SaaS home with hero, feature cards, and post grid"
```

---

## Task 7: Indigo button sweep + README + final verification

**Files:**
- Modify: button colors across `src/`, `README.md`

- [ ] **Step 1: Sweep accent classes to indigo**

Replace the leftover blue/black accent utilities so studio/admin/account buttons and
links match the indigo theme. Run from repo root:
```bash
grep -rl 'blue-600\|blue-700' src | xargs sed -i '' -e 's/blue-600/primary/g' -e 's/blue-700/primaryDark/g'
```
Then change the editor Save button from black to indigo:
```bash
sed -i '' 's/bg-black px-4 py-2 text-white/bg-primary px-4 py-2 text-white/' src/components/PostEditor.tsx
```
(`sed -i ''` is the macOS form. After running, eyeball `git diff` to confirm only
className strings changed — `bg-blue-600`→`bg-primary`, `text-blue-600`→`text-primary`,
etc.)

- [ ] **Step 2: Append a UI section to `README.md`**

Append:
```markdown

## UI (SaaS theme)

Light enterprise-SaaS look (indigo primary): light top nav with Sign In / Get
Started, a home hero + feature cards + 3-column post grid with client-side search,
and custom `/login`, `/register`, and `/forgot` pages (the Amplify Authenticator was
replaced). `/auth` redirects to `/login`. "Continue with Google" is a styled
placeholder until a Cognito Google identity provider is configured.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all unit tests pass (including `tests/authErrors.test.ts`).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: succeeds; routes include `/`, `/login`, `/register`, `/forgot`, `/auth`,
`/posts/[slug]`, `/account`, `/admin/*`, `/studio/*`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): indigo button sweep and SaaS UI docs"
```

---

## Self-review — spec coverage

| Spec requirement | Task |
|---|---|
| Indigo primary theme tokens | Task 1 |
| Light SSaaS nav (brand, links, Sign In / Get Started) | Task 5 |
| Hero + feature cards + post card grid + search | Task 6 |
| Minimal footer | Task 5 |
| Custom `/login` (email/pwd, forgot link, Google placeholder, register link, confirm step) | Task 3 |
| `/register` (signup + confirm code) and `/forgot` (reset flow) | Task 4 |
| `/auth` redirects to `/login` | Task 4 |
| Replace Amplify Authenticator | Tasks 3–5 (Authenticator + ui-react css removed) |
| Category chip indigo; post detail inherits | Task 1 |
| Retire ArticleCard/Sidebar/SearchContext | Task 6 |
| Studio/Admin adopt theme (indigo buttons) | Task 7 |
| Auth error helper (TDD) | Task 2 |
| Tests + docs | Tasks 2, 7 |

**Out of scope (per spec):** real Google OAuth, schema/backend changes, dark mode, pagination.
