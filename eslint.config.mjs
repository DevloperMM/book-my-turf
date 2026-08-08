import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import nextPrettier from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  nextPrettier,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'coverage/**', 'generated/**']),
  {
    rules: {
      'no-console': 'error',
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      quotes: ['error', 'single', { allowTemplateLiterals: true }]
    }
  }
])

export default eslintConfig
