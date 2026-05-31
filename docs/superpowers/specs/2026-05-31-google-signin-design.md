# Real Google Sign-In — Design / Spec

**Date:** 2026-05-31
**Status:** Approved — code changes implemented; deploy + Google config are user steps
**Target:** local sandbox first (callback `http://localhost:3000/`)

## Goal

Federate Cognito with Google so the existing "Continue with Google" button performs a
real OAuth sign-in (replacing the placeholder).

## Decisions

| Item | Choice |
|---|---|
| Credentials | User already has a Google OAuth 2.0 **Web application** client (ID + secret) |
| Secret delivery | `npx ampx sandbox secret set GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (user runs; never in chat/git) |
| Environment | Local sandbox first; production Amplify Hosting is a follow-up |
| Scopes | `openid`, `email`, `profile`; map Google `email` → Cognito `email` |

## Code changes

1. **`amplify/auth/resource.ts`** — add Google under `loginWith.externalProviders`,
   referencing `secret('GOOGLE_CLIENT_ID')` / `secret('GOOGLE_CLIENT_SECRET')`, with
   `scopes`, `attributeMapping`, and `callbackUrls`/`logoutUrls` set to
   `http://localhost:3000/`. Email login, groups, and the seed-admin trigger are
   unchanged.
2. **`src/components/GoogleButton.tsx`** — replace the placeholder click handler with
   `signInWithRedirect({ provider: 'Google' })`; show an error only if the redirect
   fails to start.

## Sequence (chicken-and-egg)

Google's authorized redirect URI is Cognito's hosted-UI domain, which only exists
after deploy. Order:

1. User sets the two secrets (`ampx sandbox secret set ...`).
2. Deploy the sandbox (`ampx sandbox`), which provisions the Google IdP + a Cognito
   user-pool domain (appears in `amplify_outputs.json` under `auth.oauth.domain`).
3. Read the domain; user adds **`https://<domain>/oauth2/idpresponse`** as an
   Authorized redirect URI on the Google client, and `http://localhost:3000` as an
   Authorized JavaScript origin.
4. Test the button at `http://localhost:3000/login`.

## Behavior notes

- Federated Google users land as **Reader** (no Cognito group); `ensureProfile`
  creates their `UserProfile`; promote via `/admin`. The seed-admin auto-promote
  trigger only applies to email/password sign-ups.
- After Google → Cognito redirects back to `http://localhost:3000/`, Amplify v6
  completes the code exchange and the `useCurrentUser` Hub listener reflects the
  signed-in session.

## Out of scope

Production/Amplify-Hosting Google config (same secrets + prod callback URL) — a
follow-up. No other auth changes.
