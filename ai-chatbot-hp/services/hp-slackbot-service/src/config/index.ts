import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(4006),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.string().default('development'),
  
  // Slack Auth
  SLACK_SIGNING_SECRET: z.string(),
  SLACK_BOT_TOKEN: z.string(),
  
  // Internal Platform Auth
  INTERNAL_SERVICE_TOKEN: z.string(),
  GATEWAY_URL: z.url(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  
  // Service ID
  SERVICE_NAME: z.string().default('hp-slackbot-service'),
});

const loadConfig = () => {
  const result = ConfigSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid Slackbot Service configuration:', result.error.format());
    process.exit(1);
  }
  
  return result.data;
};

export const config = loadConfig();
export default config;
