// Recognises whichever variant of "myself" a person entry might be named,
// so Self-detection is consistent everywhere it's used.
export function isSelfPerson(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return n === 'self' || n === 'my self' || n === 'myself';
}
