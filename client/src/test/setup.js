import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy*/waitFor default to 1 s, which full parallel runs can exceed on slower machines.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
})
