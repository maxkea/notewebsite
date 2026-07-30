const pino = require('pino');
const path = require('path');

const logFilePath = path.join(__dirname, 'logs', 'backend_log.log');
const logger = pino(
  {
  timestamp: pino.stdTimeFunctions.isoTime, 
  formatters: {
    level(label) {
      return { level: label }; 
    },
    },
  base: { service: 'node_backend' }, 
  },
  pino.multistream([
    { stream: process.stdout }, // Vẫn in ra màn hình console
    { stream: pino.destination({ dest: logFilePath, mkdir: true, sync: false }) } // Ghi vào file tùy tên
  ])
);

module.exports = logger;