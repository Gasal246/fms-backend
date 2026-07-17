
import type { NextFunction, Request, Response } from "express";
import { httpRequestDuration } from "../../infrastructure/monitoring/metrics.js";


export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    end({
      method: req.method,
      route: req.route?.path || req.url,
      status: res.statusCode,
    });
  });

  next();
};