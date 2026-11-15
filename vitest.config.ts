import { defineConfig } from 'vitest/config'

// Only the pure logic of src/core runs in Node (tests/); the screens are tried on the phone.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } })
