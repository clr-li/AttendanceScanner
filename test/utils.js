/* node:coverage disable */
// Capture console log output in a separate file so it doesn't conflict with test output.
const { createWriteStream } = require('fs');

module.exports.captureConsole = (filePath = './test.log') => {
  const clear = createWriteStream(filePath, {flags: 'w'})
  clear.write('')
  clear.close();
  const tty = createWriteStream(filePath, {flags: 'a'});
  console.log = async (...messages) => {
    for (const message of messages) {
      const msg = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
      tty.write(msg + '\n');
    }
  }
  console.error = console.log;
  console.log('# Test logs created on ' + new Date().toISOString());
};