import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // .tsx renderer tests will be enabled when happy-dom is added and components are implemented
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
})
