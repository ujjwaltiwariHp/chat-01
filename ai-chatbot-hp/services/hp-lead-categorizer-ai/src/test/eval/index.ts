import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock Redis environment to avoid connection hangs during standalone evaluation
process.env.REDIS_URL = 'redis://localhost:6379';
import { config } from '../../config.js';

import { leadIntelligenceAIService } from '../../services/lead-intelligence-ai.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ICP = {
  target_industries: ["technology", "fintech", "e-commerce", "healthcare"],
  company_size_range: "10-500 employees",
  budget_range_min: 200000,
  budget_range_max: 5000000,
  deal_breaker_signals: ["budget below 1 lakh", "student project", "just looking for free advice"],
  strong_fit_signals: ["clear budget", "defined timeline", "technical decision maker", "repeat client"],
  services_offered: ["mobile app development", "web development", "AI/ML solutions", "cloud consulting", "UI/UX design"]
};

const ICP_PLAIN_TEXT = "We target mid-size tech companies and startups that need custom software solutions. Best clients have clear requirements, realistic budgets above 2L, and timelines of 1-6 months.";

async function runEval() {
  const testCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-cases.json'), 'utf-8'));
  const results = [];
  const MODELS_TO_TEST = [config.LEAD_BASIC_ANALYSIS_MODEL, 'gpt-4o-mini-latest'];

  console.log(`🚀 Starting Eval Framework: ${testCases.length} cases across ${MODELS_TO_TEST.join(', ')}`);

  for (const tc of testCases) {
    console.log(`\n--- Case: ${tc.name} [${tc.id}] ---`);
    const caseResults: any = { id: tc.id, name: tc.name, runs: {} };

    for (const model of MODELS_TO_TEST) {
      try {
        console.log(`  ✨ [${model}] Processing...`);
        
        const normRes = await leadIntelligenceAIService.normalizeLead({
          source: tc.source,
          rawPayload: tc.payload,
          tenantName: 'HangingPanda Eval'
        });

        const analysisRes = await leadIntelligenceAIService.analyzeLead({
          tier: 'basic',
          model: model,
          lead: normRes.data as any,
          icpProfile: ICP,
          tenantName: 'HangingPanda Eval'
        });

        caseResults.runs[model] = {
          classification: analysisRes.data.classification,
          confidence: analysisRes.data.confidence,
          cost: analysisRes.costEstimate,
          matched: analysisRes.data.classification === tc.expected.classification
        };
      } catch (err: any) {
        console.error(`  ❌ [${model}] failed: ${err.message}`);
        caseResults.runs[model] = { error: err.message };
      }
    }
    results.push(caseResults);
  }

  const outputPath = path.join(__dirname, 'eval-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n🏁 Eval Complete. Results saved to: ${outputPath}`);
}

runEval().catch(console.error);
