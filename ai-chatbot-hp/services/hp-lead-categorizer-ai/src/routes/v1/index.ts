import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { config } from "@/config.js";
import { costKillSwitchMiddleware } from "@/utils/billing.js";
import {
  compatibilityInvokeController,
  createRoutingRuleController,
  createTeamController,
  deleteRoutingRuleController,
  deleteTeamController,
  getIcpController,
  getOpenAISettingsController,
  getSlackSettingsController,
  getUsageController,
  getWebhookSettingsController,
  ingestChatbotLeadController,
  ingestFormLeadController,
  ingestManualLeadController,
  listRoutingRulesController,
  listTeamController,
  putOpenAISettingsController,
  putSlackSettingsController,
  putWebhookSettingsController,
  getConsentSettingsController,
  putConsentSettingsController,
  getCostLimitController,
  putCostLimitController,
  updateRoutingRuleController,
  updateTeamController,
  upsertIcpController,
  submitFeedbackController,
} from "@/controllers/lead-intelligence.controller.js";

const routes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post(
    "/invoke",
    {
      preHandler: costKillSwitchMiddleware,
    },
    compatibilityInvokeController,
  );

  fastify.register(
    async (leadRoutes) => {
      // Add cost kill switch to all intelligence routes
      leadRoutes.addHook("preHandler", costKillSwitchMiddleware);

      leadRoutes.post("/leads", ingestManualLeadController);
      leadRoutes.post("/leads/ingest/form", ingestFormLeadController);
      leadRoutes.post("/leads/ingest/chatbot", ingestChatbotLeadController);

      leadRoutes.get("/icp", getIcpController);
      leadRoutes.put("/icp", upsertIcpController);

      leadRoutes.get("/routing-rules", listRoutingRulesController);
      leadRoutes.post("/routing-rules", createRoutingRuleController);
      leadRoutes.put("/routing-rules/:id", updateRoutingRuleController);
      leadRoutes.delete("/routing-rules/:id", deleteRoutingRuleController);

      leadRoutes.get("/team", listTeamController);
      leadRoutes.post("/team", createTeamController);
      leadRoutes.put("/team/:id", updateTeamController);
      leadRoutes.delete("/team/:id", deleteTeamController);

      leadRoutes.get("/settings/slack", getSlackSettingsController);
      leadRoutes.put("/settings/slack", putSlackSettingsController);
      leadRoutes.get("/settings/webhooks", getWebhookSettingsController);
      leadRoutes.put("/settings/webhooks", putWebhookSettingsController);
      leadRoutes.get("/settings/openai", getOpenAISettingsController);
      leadRoutes.put("/settings/openai", putOpenAISettingsController);
      leadRoutes.get("/settings/consent", getConsentSettingsController);
      leadRoutes.put("/settings/consent", putConsentSettingsController);
      leadRoutes.get("/settings/cost-limit", getCostLimitController);
      leadRoutes.put("/settings/cost-limit", putCostLimitController);
      leadRoutes.get("/usage", getUsageController);
      leadRoutes.post("/leads/:id/feedback", submitFeedbackController);
    },
    { prefix: config.LEAD_INTELLIGENCE_PREFIX },
  );
};

export default routes;
