import mongoose from "mongoose";
import { logger } from "../shared/logger/logger.js";
import { env } from "./env.config.js";
import { formatMongoConnectionError, formatMongoConnectionTarget } from "../shared/utils/mongoDiagnostics.js";
import { seedPermissions, migrateComplianceData, migrateMissingEmployeeIds } from "../infrastructure/persistence/compliance-seeder.js";

const connectDB = async () => {
  try {
    logger.info(`Connecting to MongoDB: ${formatMongoConnectionTarget("DB_URL", env.dburl)}`);
    await mongoose.connect(env.dburl);

    logger.info(`Database connected successfully: ${formatMongoConnectionTarget("DB_URL", env.dburl)}`);

    // Seed and Migrate asynchronously
    seedPermissions()
      .then(() => migrateComplianceData())
      .then(() => migrateMissingEmployeeIds())
      .catch(err => {
        logger.error(`Post-connection database setup error: ${err}`);
      });
  } catch (error) {
    logger.error(formatMongoConnectionError("DB_URL", env.dburl, error));
    process.exit(1);
  }
};

export default connectDB;
