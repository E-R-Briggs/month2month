module.exports = {
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: true }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|drizzle-orm|@expo|expo|react-native|react-native-.*|@react-native|react-native-worklets|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-screens)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-sqlite$': '<rootDir>/__tests__/helpers/mock-expo-sqlite.ts',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/helpers/',
  ],
  testEnvironment: 'node',
};
