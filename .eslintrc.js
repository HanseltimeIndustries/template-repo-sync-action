module.exports = {
  env: {
    node: true,
  },
  ignorePatterns: ["lib/**/*", "bundle/**/*"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  root: true,
};
