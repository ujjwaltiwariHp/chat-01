export const PROMPT_VERSIONS = {
  dev: {
    NORMALIZATION: 'latest',
    ANALYSIS_BASIC: 'latest',
    ANALYSIS_DEEP: 'latest',
    DRAFT: 'latest',
    CANARY_ANALYSIS: 'latest',
  },
  staging: {
    NORMALIZATION: '1.2.0-rc',
    ANALYSIS_BASIC: '1.2.0-rc',
    ANALYSIS_DEEP: '1.2.0-rc',
    DRAFT: '1.1.0-rc',
    CANARY_ANALYSIS: '1.2.0-rc',
  },
  canary: {
    NORMALIZATION: '1.1.0',
    ANALYSIS_BASIC: '1.1.0',
    ANALYSIS_DEEP: '1.1.0',
    DRAFT: '1.0.1',
    CANARY_ANALYSIS: '1.1.0',
  },
  prod: {
    NORMALIZATION: '1.0.0',
    ANALYSIS_BASIC: '1.0.0',
    ANALYSIS_DEEP: '1.0.0',
    DRAFT: '1.0.0',
    CANARY_ANALYSIS: 'none',
  },
} as const;

export type Stage = keyof typeof PROMPT_VERSIONS;

export const SCHEMA_VERSIONS = {
  NORMALIZATION: '1.0.0',
  ANALYSIS: '1.0.0',
  DRAFT: '1.0.0',
} as const;
