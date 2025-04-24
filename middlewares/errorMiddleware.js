import logger from "../utils/logger.js";

const errorMiddleware = (error, req, res, next) => {
    const message = error.message || "Internal server error";
    const statusCode = error.statusCode || 500;

    const stack = error.stack.split("\n")[1]?.trim();
    logger.error(error);

    return res.status(statusCode).json({ success: false, error: message });
};

export default errorMiddleware;
