import 'dotenv/config';
import { createApp } from './app';
import { APP_CONFIG, HF_CONFIG } from './config';
import { logger } from './utils';

const app = createApp();

logger.info('🔧 Environment check:');
logger.info(`   PORT: ${APP_CONFIG.PORT}`);
logger.info(`   HF_API_KEY: ${HF_CONFIG.TOKEN ? '✓ Set' : '✗ Missing'}`);
logger.info(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Missing'}`);

app.listen(APP_CONFIG.PORT, () => {
  logger.success(`\n🚀 API server running on http://localhost:${APP_CONFIG.PORT}`);
});
