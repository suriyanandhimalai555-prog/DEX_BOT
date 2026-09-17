/** Shared password rules for registration, env, and admin seed. */
export function passwordPolicyMessage(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
}

export function isStrongPassword(password: string): boolean {
  return passwordPolicyMessage(password) === null;
}
