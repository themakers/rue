import globals from 'globals'
import js from '@eslint/js'
import ts from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier/recommended'

const globalsConfig = {
  ...globals.node,
  ...globals.browser,
}

const rules = {
  'prettier/prettier': 'error',
  'prefer-const': 0,
  '@typescript-eslint/ban-ts-comment': 0,
  '@typescript-eslint/explicit-module-boundary-types': 0,
  '@typescript-eslint/no-unsafe-function-type': 0,
  '@typescript-eslint/no-explicit-any': 0,
  '@typescript-eslint/no-empty-function': 0,
  '@typescript-eslint/ban-types': 0,
}

export default [
  { languageOptions: { globals: globalsConfig } },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  { rules },
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.cache/**', '**/.expo/**'] },
]
