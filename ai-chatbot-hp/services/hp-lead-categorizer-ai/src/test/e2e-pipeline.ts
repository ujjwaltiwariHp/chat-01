import { db } from "../db/connection.js";
import { tenants, users } from "@hp-intelligence/core";
import { leads, leadAnalyses, routingRules } from "../db/schema.js";
import leadIntelligenceService from "../services/lead-intelligence.service.js";
import leadIntelligenceAIService from "../services/lead-intelligence-ai.service.js";
import { eq } from "drizzle-orm";

async function runE2E() {
  console.log("🚀 Starting End-to-End Pipeline Test");

  // 1. Setup Tenant & User
  const [t] = await db
    .insert(tenants as any)
    .values({
      name: "E2E Tenant",
      slug: "e2e-" + Date.now(),
      apiKey: "e2e-api-key-" + Date.now(),
      credits: 100000,
    })
    .returning();

  const [u] = await db
    .insert(users as any)
    .values({
      tenantId: t.id,
      name: "E2E Agent",
      email: `e2e-${Date.now()}@test.com`,
      role: "admin",
    })
    .returning();

  console.log(`Setup complete for tenant ${t.id}`);

  // 2. Setup Routing Rule
  await db.insert(routingRules).values({
    tenantId: t.id,
    priority: 1,
    conditionField: "classification",
    conditionOperator: "eq",
    conditionValue: "HOT",
    actionAssignTo: u.id,
  });
  console.log("Routing rule created to assign HOT leads to E2E Agent");

  // 3. Mock AI Global for deterministic testing
  // We mock normalizeLead and analyzeLead to avoid external API calls
  const originalNormalize = leadIntelligenceAIService.normalizeLead;
  const originalAnalyze = leadIntelligenceAIService.analyzeLead;

  (leadIntelligenceAIService as any).normalizeLead = async () => ({
    success: true,
    data: {
      name: "John Doe",
      email: "john@doe.com",
      message_summary: "Interested in AI consulting with $50k budget.",
      source_type: "chatbot",
      confidence: 0.95,
      needs_human_review: false,
      is_spam: false,
      extracted_context: {
        mentioned_budget: "$50k",
        mentioned_services: ["AI Consulting"],
      },
    },
    usage: { totalTokens: 100 },
    costEstimate: 0.0001,
  });

  (leadIntelligenceAIService as any).analyzeLead = async () => ({
    success: true,
    data: {
      summary: "High potential AI lead.",
      classification: "HOT",
      intent: "READY_TO_START",
      classification_reasoning: "Strong budget and clear intent.",
      scoring_factors: [
        { factor: "Budget", value: "$50k", impact: "positive" },
      ],
      extracted_attributes: {
        budget_range: "$50k",
        service_needed: "AI Consulting",
      },
      risk_flags: [],
      suggested_action: "Call immediately.",
      confidence: 0.98,
      needs_human_review: false,
      prompt_version: "1.0.0",
      schema_version: "1.0.0",
    },
    usage: { totalTokens: 200 },
    costEstimate: 0.0005,
  });

  try {
    // 4. Ingest Lead (Simulating inbound chatbot payload)
    console.log("Ingesting mock chatbot lead...");
    const result = await leadIntelligenceService.ingestLead({
      tenantId: t.id,
      requestId: "e2e-test-" + Date.now(),
      source: "chatbot",
      payload: {
        visitor: { name: "John Doe", email: "john@doe.com" },
        transcript: [
          { role: "user", content: "Hi, I need help with AI." },
          { role: "assistant", content: "Sure, what is your budget?" },
          { role: "user", content: "Around $50k." },
        ],
      },
    });

    const leadId = result.leadId;
    console.log(`Lead ingested with ID: ${leadId}`);

    // 5. In a real scenario, BullMQ handles workers.
    // Here we manually trigger the processing chain to verify logic.
    console.log("Processing lead normalization...");
    await (leadIntelligenceService as any).processNormalizationJob({
      data: {
        tenantId: t.id,
        leadId: leadId,
        source: "chatbot",
        merged: false,
      },
      opts: { attempts: 1 },
      attemptsMade: 0,
    });

    console.log("Processing lead analysis...");
    await (leadIntelligenceService as any).processAnalysisJob({
      data: {
        tenantId: t.id,
        leadId: leadId,
        tier: "basic",
      },
      opts: { attempts: 1 },
      attemptsMade: 0,
    });

    // 6. Verify Results
    const finalLead = (await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
    })) as any;

    console.log("Final Lead Status:", finalLead.status);
    console.log("Final Lead Classification:", finalLead.classification);
    console.log(
      "Assigned To:",
      finalLead.assignedTo === u.id
        ? "E2E Agent (Success)"
        : "Wrong User (Fail)",
    );

    if (finalLead.classification === "HOT" && finalLead.assignedTo === u.id) {
      console.log("✅ E2E Pipeline PASSED");
    } else {
      console.error("❌ E2E Pipeline FAILED");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ E2E error:", error);
    process.exit(1);
  } finally {
    // Restore original methods
    (leadIntelligenceAIService as any).normalizeLead = originalNormalize;
    (leadIntelligenceAIService as any).analyzeLead = originalAnalyze;
    process.exit(0);
  }
}

runE2E().catch(console.error);
