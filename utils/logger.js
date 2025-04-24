import winston from "winston";
import "winston-daily-rotate-file";

const transport = new winston.transports.DailyRotateFile({
    filename: "logs/%DATE%.log",
    datePattern: "DD_MM_YYYY",
    level: "error",
    zippedArchive: true,
    maxSize: "20m",
});

const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            // if stack exists, we print it; otherwise just message
            return stack ? `${timestamp} [${level}] ${message}\n${stack}` : `${timestamp} [${level}] ${message}`;
        })
    ),
    transports: [transport],
});

export default logger;
