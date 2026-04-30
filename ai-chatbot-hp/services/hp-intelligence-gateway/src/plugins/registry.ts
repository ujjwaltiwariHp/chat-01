import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import botRegistry from '@/config/bots.json' with { type: 'json' };
import { config } from '@/config.js';

export interface Bot {
  name: string;
  baseUrl: string;
  invokePath: string;
  costPerInvoke: number;
  description: string;
  billingMode?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    botRegistry: {
      getBot: (name: string) => Bot | undefined;
      getAllBots: () => Bot[];
    };
  }
}

/**
 * AI Bot Registry Plugin (Gateway)
 * Manages the inventory of supported internal and external AI services.
 */
const registryModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const serviceUrlOverrides: Record<string, string | undefined> = {
    chatbot: config.CHATBOT_SERVICE_URL,
    'lead-categorizer': config.LEAD_CATEGORIZER_SERVICE_URL,
    'hr-policy': config.HR_POLICY_SERVICE_URL,
  };

  const bots: Bot[] = botRegistry.bots.map((bot) => ({
    ...bot,
    baseUrl: serviceUrlOverrides[bot.name] || bot.baseUrl,
  }));

  fastify.decorate('botRegistry', {
    getBot: (name: string) => bots.find(b => b.name === name),
    getAllBots: () => bots,
  });
};

export const registryPlugin = fp(registryModule);
export default registryPlugin;
