import 'dotenv/config'; // load .env into process.env BEFORE config/env validates it
import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * Server bootstrap. `env` is validated at import time (config/env.ts), so an
 * invalid environment crashes the process before it ever binds a port —
 * fail-fast, never start half-configured (docs/ARCHITECTURE.md §16).
 */
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('server.started', { port: env.PORT, env: env.NODE_ENV });
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info('server.shutdown', { signal });
    server.close(() => process.exit(0));
  });
}
