module.exports = {
    "testTimeout": 35000,
    "runner": "<rootDir>/jest-runner.js",
    "roots": [
        "<rootDir>/src"
    ],
    "testMatch": [
        "**/__tests__/*.test.(ts|tsx|js)"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
}
