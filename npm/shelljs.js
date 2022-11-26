// This is to bypass an issue with detecting Electron and refusing to use it
const shx = require('shelljs');

shx.config.fatal = true;
shx.config.execPath = process.execPath;

module.exports = shx;