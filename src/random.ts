// tweetnacl needs a source of randomness: on the phone, the system's (expo-crypto). Imported first in index.ts.
import nacl from 'tweetnacl'
import { getRandomValues } from 'expo-crypto'

nacl.setPRNG((out: Uint8Array, n: number) => {
  const bytes = getRandomValues(new Uint8Array(n))
  for (let i = 0; i < n; i++) out[i] = bytes[i]
})
