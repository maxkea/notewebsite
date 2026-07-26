const pino = require('pino');

const logger = pino({
  timestamp: pino.stdTimeFunctions.isoTime, 
  formatters: {
    level(label) {
      return { level: label }; 
    },
  },
  base: { service: 'node_backend' }, 
});

module.exports = logger;