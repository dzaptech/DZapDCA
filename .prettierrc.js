module.exports = {
  semi: false,
  singleQuote: true,
  bracketSpacing: true,
  printWidth: 120,
  tabWidth: 2,
  endOfLine: "lf",
  overrides: [
    {
      files: '*.sol',
      options: {
        tabWidth: 4,
        singleQuote: false,
        explicitTypes: 'always',
        printWidth: 120
      },
    },
  ],
}

