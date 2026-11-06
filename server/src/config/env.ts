import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('dev-only-jwt-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DATA_FILE: z.string().default('./data/db.json'),
  // AI — leave AI_API_KEY empty (or set AI_MOCK=true) to use the built-in mock assistant.
  AI_API_KEY: z.string().default(''),
  AI_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  AI_MODEL: z.string().default(''),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  // AI_MOCK=true forces the built-in mock even when AI_API_KEY is set (handy for demos/offline dev).
  AI_MOCK: z
    .string()
    .default('false')
    .transform((v) => ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase())),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  AI_BASE_URL: parsed.data.AI_BASE_URL.replace(/\/+$/, ''),
  isProduction: parsed.data.NODE_ENV === 'production',
  clientOrigins: parsed.data.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
  aiEnabled: !parsed.data.AI_MOCK && parsed.data.AI_API_KEY.trim() !== '',
};

if (env.aiEnabled && !env.AI_MODEL) {
  console.error('AI_API_KEY is set but AI_MODEL is empty. Set AI_MODEL in .env (see .env.example).');
  process.exit(1);
}
if (env.isProduction && env.JWT_SECRET.startsWith('dev-only')) {
  console.error('JWT_SECRET must be set in production.');
  process.exit(1);
}
