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
