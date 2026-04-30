/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/migrations/**",
      "**/migrations_drizzle/**",
      "**/*.md",
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",
      "**/*.d.ts",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    rules: {
      "no-unused-vars": "warn",
    },
  },
];
