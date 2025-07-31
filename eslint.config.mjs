import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Ignore compiled files and other directories
  {
    ignores: [
      "build/**",
      "node_modules/**",
      "uploads/**",
      "*.config.js",
      "*.config.mjs",
    ],
  },
  
  // Base ESLint recommended rules for all files
  js.configs.recommended,
  
  // JavaScript files - CommonJS allowed
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 2022,
      sourceType: "commonjs",
    },
    rules: {
      // Allow require() in JavaScript files
    },
  },
  
  // TypeScript files configuration
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["**/*.ts"],
  })),
  
  // Custom TypeScript rules
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-namespace": "warn",
    },
  },
];
