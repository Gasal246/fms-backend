import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from '../config/env.config.js';
import router from './routes.js';
import errorHandler from '../shared/middleware/errorMiddleware.js';
import { metricsMiddleware } from '../shared/middleware/metrics.middleware.js';
import { logger } from '../shared/logger/logger.js';
import ApiLogModel from '../infrastructure/persistence/models/api-log.model.js';

const app: Application = express();



// Custom Morgan Format to JSON
const morganJsonFormat = (tokens: any, req: any, res: any) => {
  return JSON.stringify({
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res)),
    responseTime: Number(tokens['response-time'](req, res)) || 0,
    ip: tokens['remote-addr'](req, res),
    userAgent: tokens['user-agent'](req, res),
  });
};

// Middleware
app.use(helmet());
app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Console Logger for Development
app.use(morgan('dev'));

// Morgan HTTP Request Logger Middleware connected to MongoDB
app.use(morgan(morganJsonFormat as any, {
  stream: {
    write: (message: string) => {
      try {
        const logData = JSON.parse(message);
        
        // Ensure responseTime is a valid number
        if (isNaN(logData.responseTime)) {
          logData.responseTime = 0;
        }

        // Fire and forget: save to DB asynchronously so it doesn't block the request
        ApiLogModel.create(logData)
          .then(() => console.log('Log saved to DB successfully'))
          .catch(err => {
            console.error('DATABASE LOG ERROR:', err.message);
            logger.error(`Failed to save API log to DB: ${err.message}`);
          });
      } catch (err) {
        console.error('MORGAN PARSE ERROR:', err);
        logger.error(`Failed to parse Morgan log message: ${err}`);
      }
    }
  }
}));

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Facility Management System API</title>

      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
        }

        body {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a, #1e293b);
          color: #ffffff;
        }

        .container {
          width: 90%;
          max-width: 600px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 18px;
          padding: 40px 30px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 22px;
        }

        .dot {
          width: 9px;
          height: 9px;
          background: #22c55e;
          border-radius: 50%;
        }

        h1 {
          font-size: 30px;
          margin-bottom: 12px;
        }

        p {
          color: #cbd5e1;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 26px;
        }

        .info {
          background: rgba(15, 23, 42, 0.7);
          border-radius: 12px;
          padding: 16px;
          color: #94a3b8;
          font-size: 14px;
        }

        .info strong {
          color: #ffffff;
        }

        footer {
          margin-top: 24px;
          font-size: 13px;
          color: #64748b;
        }
      </style>
    </head>

    <body>
      <div class="container">
        <div class="status">
          <span class="dot"></span>
          API Running
        </div>

        <h1>Facility Management System API</h1>

        <p>
          The backend server is active and ready to handle requests.
          This page confirms that the API service is running successfully.
        </p>

        <div class="info">
          <strong>version:</strong> v1.0.3
        </div>

        <footer>
          Facility Management System Backend
        </footer>
      </div>
    </body>
    </html>
  `);
});

app.use(metricsMiddleware);
app.use('/api', router);
app.use(errorHandler);

export default app;
