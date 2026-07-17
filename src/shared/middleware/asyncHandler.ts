import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger/logger.js";


const tryCatch =
    (controller: Function) =>
        async (req: Request, res: Response, next: NextFunction) => {
            try {


                await controller(req, res, next);
            } catch (error: any) {
                console.error("STACK:", error.stack);
                logger.error(`Error in controller: ${error}`);
                next(error);
            }
        };

export default tryCatch;