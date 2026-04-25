const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
    {
        ignores: ['node_modules/**', 'package-lock.json'],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': 'warn',
        },
    },
    {
        files: ['public/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.browser,
                io: 'readonly',
            },
        },
    },
    {
        files: ['public/js/games/*-client.js'],
        languageOptions: {
            globals: {
                showStatus: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^init' }],
        },
    },
    prettier,
];
