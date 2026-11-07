import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { aiRouter } from './routes/ai.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { projectsRouter } from './routes/projects.routes.js';
import { sprintsRouter } from './routes/sprints.routes.js';
import { todosRouter } from './routes/todos.routes.js';
import type { HealthResponse } from './types/api.js';

export function createApp() {
  const app = express();
  // Behind a hosting proxy (Render, Railway, …) so req.ip / rate limiting use the real client IP.
  if (env.isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(requestLogger);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() } satisfies HealthResponse);
  });

  app.use('/api/auth', authRouter);
  app.use('/api/projects', requireAuth, projectsRouter);
  app.use('/api', requireAuth, todosRouter, sprintsRouter, aiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
