import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { recognitionService } from './services/ai';

async function main() {
  await connectDatabase();
  const server = createApp().listen(env.PORT, () => {
    console.log(`[server] http://localhost:${env.PORT}  (AI: ${recognitionService.provider}/${recognitionService.model})`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
