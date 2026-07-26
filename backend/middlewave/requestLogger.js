const { nanoid } = require('nanoid');
const logger = require('../logger');


function getLevel(status) {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

function requestLogger(req, res, next) {
  const start = Date.now();
  req.requestId = nanoid(8); 

  res.on('finish', () => {
    const duration_ms = Date.now() - start;
    const level = getLevel(res.statusCode);

    logger[level]({
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms,
      ip: req.ip,
    }, `${req.method} ${req.originalUrl} ${res.statusCode}`);
  });

  next();
}

module.exports = requestLogger;