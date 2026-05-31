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
