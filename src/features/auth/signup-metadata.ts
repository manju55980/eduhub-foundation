export function signupMetadata(fullName: string): { full_name: string } | undefined {
  const trimmed = fullName.trim();
  if (!trimmed) return undefined;
  return { full_name: trimmed };
}
