import { zodToJsonSchema } from 'zod-to-json-schema';
import { 
  LeadNormalizationSchema, 
  LeadAnalysisSchema, 
  LeadEmailDraftSchema 
} from '@/services/lead-intelligence-ai.service.js';
import { createLeadLogger } from '@/logging/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.join(__dirname, '../../schemas/generated');
const schemaLogger = createLeadLogger('schema-exporter');

if (!fs.existsSync(SCHEMA_DIR)) {
  fs.mkdirSync(SCHEMA_DIR, { recursive: true });
}

const exportSchema = (name: string, schema: any) => {
  const jsonSchema = zodToJsonSchema(schema, name);
  fs.writeFileSync(
    path.join(SCHEMA_DIR, `${name}.json`),
    JSON.stringify(jsonSchema, null, 2)
  );
  schemaLogger.info({ schemaName: name }, 'Exported schema JSON');
};

export const exportAllSchemas = () => {
  exportSchema('LeadNormalization', LeadNormalizationSchema);
  exportSchema('LeadAnalysis', LeadAnalysisSchema);
  exportSchema('LeadEmailDraft', LeadEmailDraftSchema);
};

// If run directly
if (process.argv[1] && process.argv[1].endsWith('schema-exporter.ts')) {
  exportAllSchemas();
}
