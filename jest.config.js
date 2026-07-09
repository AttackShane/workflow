export default {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js']
};