const idx = process.argv.indexOf("--outputFile");
const outputName = process.argv[idx + 1].replace(".json", ".xml");
console.log("JEST OUTPUT NAME", outputName);
module.exports = {
    "collectCoverage": true,
    "testTimeout": 35000,
    "reporters": ["default", ["jest-junit", { outputName }]],
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
