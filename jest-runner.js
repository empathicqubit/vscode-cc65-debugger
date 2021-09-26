const DefaultJestRunner = require('jest-runner').default;

class SerialJestRunner extends DefaultJestRunner {
  constructor(...args) {
    super(...args);
    this.isSerial = !!process.env.GITHUB_ACTIONS;
  }
}

module.exports = SerialJestRunner;