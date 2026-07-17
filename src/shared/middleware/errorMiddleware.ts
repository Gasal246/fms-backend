import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger/logger.js";


const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    logger.error(`Error in error handler: ${err}`);
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || err || "Internal Server Error";

    logger.error(`${statusCode} - ${message}`);

    res.status(statusCode).json({
        success: false,
        message,
    });
};

export default errorHandler;