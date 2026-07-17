import app from './app.js';
import { env } from '../config/env.config.js';
import { logger } from '../shared/logger/logger.js';
import connectDB from '../config/database.config.js';
import { startDashboardScheduler, startImportScheduler } from './scheduler.js';


const startServer = async () => {
    try {
        const port = env.port;
        app.listen(port, () => {
           logger.info(` Server is running
      Port: ${port}
      `);
        });
    } catch (error) {
        logger.error(`Error starting server:${error}`);
        process.exit(1);
    }
};
connectDB().then(() => {
    startServer();
    startDashboardScheduler();
    startImportScheduler();
}).catch((error) => {    
    logger.error(`Application failed to start: ${error}`);
    process.exit(1);
}
);
