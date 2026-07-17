import mongoose, { Document, Schema } from 'mongoose';
import { env } from '../../../config/env.config.js';
import { logger } from '../../../shared/logger/logger.js';
import { formatMongoConnectionError, formatMongoConnectionTarget } from '../../../shared/utils/mongoDiagnostics.js';

export interface IApiLog extends Document {
  method: string;
  url: string;
  status: number;
  responseTime: number;
  ip: string;
  userAgent: string;
  date: Date;
}

const apiLogSchema = new Schema<IApiLog>(
  {
    method: { type: String, required: true },
    url: { type: String, required: true },
    status: { type: Number, required: true },
    responseTime: { type: Number },
    ip: { type: String },
    userAgent: { type: String },
    date: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    capped: { size: 5242880, max: 500 } // 5MB max size, strictly 500 documents
  }
);

// Add indexes for efficient querying/debugging later
apiLogSchema.index({ date: -1 });
apiLogSchema.index({ status: 1 });
apiLogSchema.index({ method: 1 });

// Create a separate connection for logs (Professional isolation)
logger.info(`Connecting to logging MongoDB: ${formatMongoConnectionTarget('LOG_DB_URL', env.logDbUrl)}`);
const logConnection = mongoose.createConnection(env.logDbUrl);

logConnection.on('connected', async () => {
  logger.info(`Logging database connected successfully: ${formatMongoConnectionTarget('LOG_DB_URL', env.logDbUrl)}`);
  try {
    await ApiLogModel.create({
      method: 'TEST',
      url: '/test-connection',
      status: 200,
      responseTime: 10,
      ip: '127.0.0.1',
      userAgent: 'TestAgent'
    });
    logger.info('Test log successfully written to MongoDB!');
  } catch (err) {
    logger.error(`Failed to write test log: ${err}`);
  }
});

logConnection.on('error', (error) => {
  logger.error(formatMongoConnectionError('LOG_DB_URL', env.logDbUrl, error));
});

export const ApiLogModel = logConnection.model<IApiLog>('ApiLog', apiLogSchema);
export default ApiLogModel;
