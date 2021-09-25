// serial-jest-runner.js
const DefaultJestRunner = require('jest-runner');

class SerialJestRunner extends DefaultJestRunner {
  constructor(...args) {
    super(...args);
    this.isSerial = !!process.env.GITHUB_ACTIONS;
  }
}

module.exports = SerialJestRunner;