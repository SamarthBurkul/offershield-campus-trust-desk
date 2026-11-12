import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, expect } from 'vitest'

// Extend the same `expect` instance the test files import. The side-effect entry
// ('@testing-library/jest-dom/vitest') was intermittently extending a different instance on this
// machine, which made every matcher fail with "Invalid Chai property".
expect.extend(matchers)

// findBy*/waitFor default to 1 s, which full parallel runs can exceed on slower machines.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
})
