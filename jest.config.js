const idx = process.argv.indexOf("--outputFile");
let outputName = '';
if(idx > -1) {
    outputName = process.argv[idx + 1].replace(".json", ".xml");
    console.log("JEST OUTPUT NAME", outputName);
}
module.exports = {
    "collectCoverage": true,
    "testTimeout": 40000,
    "reporters": [
        "default",
        "github-actions",
        ["jest-junit", { outputName }],
        ["jest-html-reporter", {
            "pageTitle": "Test Report",
        }],
    ],
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
