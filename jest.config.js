module.exports = {
    "testTimeout": 30000,
    "roots": [
        "<rootDir>/src"
    ],
    "testMatch": [
        "**/__tests__/*.+(ts|tsx|js)"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
}
