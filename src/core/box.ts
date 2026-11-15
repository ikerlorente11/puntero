// The box every message travels in after the handshake: NaCl secretbox (XSalsa20-Poly1305), the same
// construction the PC opens with the crypto_secretbox crate. A frame is the 24-byte random nonce
// followed by the sealed bytes. Randomness: tweetnacl's PRNG, set from expo-crypto in random.ts.
import nacl from 'tweetnacl'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function fromB64(text: string): Uint8Array {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function fromHex(hex: string): Uint8Array | null {
  if (!/^([0-9a-f]{2})*$/i.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export const randomBytes = (n: number) => nacl.randomBytes(n)

export function seal(key: Uint8Array, value: unknown): Uint8Array {
  const nonce = nacl.randomBytes(24)
  const sealed = nacl.secretbox(encoder.encode(JSON.stringify(value)), nonce, key)
  const frame = new Uint8Array(24 + sealed.length)
  frame.set(nonce)
  frame.set(sealed, 24)
  return frame
}

export function open<T = any>(key: Uint8Array, frame: Uint8Array): T | null {
  if (frame.length < 24 + 16) return null
  const plain = nacl.secretbox.open(frame.subarray(24), frame.subarray(0, 24), key)
  if (!plain) return null
  try { return JSON.parse(decoder.decode(plain)) } catch { return null }
}

/** The key a pairing request is sealed with when the 6-digit code is typed instead of scanning the QR. */
export function codeKey(code: string): Uint8Array {
  return nacl.hash(encoder.encode(`puntero-pair-v1:${code}`)).slice(0, 32)
}
