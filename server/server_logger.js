const path = require("path");
const { createLogger, transports, format } = require("winston");
require('winston-daily-rotate-file');

const readStreamLogger = createLogger({
  level: "info",
  transports: [
    new transports.DailyRotateFile({
      filename: path.join(
        __dirname,
        "/logs/read/read_stream_%DATE%.log"
      ),
      datePattern: 'YYYY-MM-DD-HH',
      maxSize: '20m',
      level: "info",
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
    }),
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
    }),
  ],
});

const writeStreamLogger = createLogger({
  level: "info",
  transports: [
    new transports.DailyRotateFile({
      filename: path.join(
        __dirname,
        "/logs/write/write_stream_%DATE%.log"
      ),
      datePattern: 'YYYY-MM-DD-HH',
      maxSize: '20m',
      level: "info",
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
    }),
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
    }),
  ],
});

module.exports = {
  readStreamLogger,
  writeStreamLogger,
};
