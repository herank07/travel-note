// Random codes for invites, device links and recovery. No I, O, 0, 1.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(length = 8, fillRandom = (a) => crypto.getRandomValues(a)) {
  const bytes = fillRandom(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}
