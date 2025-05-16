import js from "@eslint/js";
import ts from 'typescript-eslint';
import compat from 'eslint-plugin-compat'

export default [
    js.configs.recommended,
    compat.configs["flat/recommended"],
    {
        ignores: [
            "build/",
            "dist/",
            "coverage/",
        ],
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "warn",
            "indent": ["error", 4, {
                "SwitchCase": 1,
                "flatTernaryExpressions": true,
                "ignoredNodes": ["ConditionalExpression", "LineComment"],
                "MemberExpression": 1,
                "FunctionDeclaration": { "parameters": "first" },
                "FunctionExpression": { "parameters": "first" },
                "ArrayExpression": "first",
                "ObjectExpression": "first",
                "ImportDeclaration": "first"
            }],
            "linebreak-style": ["error", "windows"],
            "quotes": ["error", "double", {
                "avoidEscape": true
            }],
            "semi": ["error", "never"],
            "brace-style": ["warn", "stroustrup", {
                "allowSingleLine": true
            }],
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    ...ts.configs.recommendedTypeChecked,
    ...ts.configs.stylisticTypeChecked,
    {
        files: ['**/*.ts'],
        ignores: [
            "**/*.js",
            "**/*.mjs",

        ],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "no-restricted-syntax": [
                "error",
                // Ban all enums
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use POJOs and/or union types instead of TS enums",
                },
            ],
            "@typescript-eslint/ban-ts-comment": ["error", {
                "ts-ignore": "allow-with-description"
            }],
        },
    }
];
