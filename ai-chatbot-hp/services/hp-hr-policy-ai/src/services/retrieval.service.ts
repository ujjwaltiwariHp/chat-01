import { encrypt, logger } from "@hp-intelligence/core";
import { config } from "@/config/index.js";
import { pool } from "@/db/connection.js";
import { formatVector } from "@/lib/pgvector.js";
import { embedText } from "@/services/embedding.service.js";
import { RetrievedChunk } from "@/types/rag.js";

const retrievalLogger = logger.child({ ns: "hr-policy:retrieval" });

interface RetrievedChunkRow {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: string | number;
  sourceUrl: string | null;
  chunkIndex: number;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "about",
  "what",
  "is",
  "are",
  "was",
  "were",
  "i",
  "you",
  "we",
  "they",
  "can",
  "could",
  "should",
  "please",
  "tell",
  "me",
  "my",
  "your",
  "this",
  "that",
  "it",
  "policy",
  "help",
  "need",
  "want",
  "do",
  "does",
  "did",
  "how",
  "when",
  "where",
  "why",
  "which",
  "who",
  "if",
  "from",
  "under",
  "into",
  "at",
  "by",
  "be",
  "as",
  "up",
  "out",
  "more",
  "less",
  "then",
  "there",
  "their",
  "our",
  "his",
  "her",
  "its",
  "all",
  "any",
  "per",
  "day",
  "days",
  "month",
  "year",
  "years",
  "can",
]);

const MIN_QUERY_TERM_LENGTH = 3;

export const extractQueryTerms = (query: string): string[] => {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(
          (term) =>
            term.length >= MIN_QUERY_TERM_LENGTH && !STOP_WORDS.has(term),
        ),
    ),
  );
};

export const retrievePolicyContext = async (
  tenantId: string,
  query: string,
  limit = config.RAG_TOP_K,
): Promise<RetrievedChunk[]> => {
  const embedding = await embedText(query);
  const vectorLiteral = formatVector(embedding);
  const terms = extractQueryTerms(query);

  const similarityQuery = [
    "SELECT",
    'pc.id AS "chunkId",',
    'pc.document_id AS "documentId",',
    'pd.title AS "title",',
    'pc.content AS "content",',
    '1 - (pc.embedding <=> $2::vector) AS "score",',
    'pd.source_url AS "sourceUrl",',
    'pc.chunk_index AS "chunkIndex"',
    "FROM policy_chunks pc",
    "INNER JOIN policy_documents pd ON pd.id = pc.document_id",
    "WHERE pd.tenant_id = $1::uuid",
    "AND pd.status = 'ready'",
    "ORDER BY pc.embedding <=> $2::vector",
    "LIMIT $3",
  ].join(" ");

  const result = await pool.query<RetrievedChunkRow>(similarityQuery, [
    tenantId,
    vectorLiteral,
    limit,
  ]);

  const vectorMatches: RetrievedChunk[] = result.rows
    .map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      title: row.title,
      content: row.content,
      score: Number(row.score),
      sourceUrl: row.sourceUrl,
      chunkIndex: Number(row.chunkIndex),
    }))
    .filter((row) => row.score >= config.RAG_MIN_SCORE);

  const keywordMatches = await fetchKeywordMatches(tenantId, terms, limit);

  const matches = mergeMatches(vectorMatches, keywordMatches)
    .filter((row) => row.score >= config.RAG_MIN_SCORE)
    .slice(0, config.RAG_MAX_CONTEXT_CHUNKS);

  retrievalLogger.info({
    msg: "Policy retrieval completed",
    tenantId,
    requestedTopK: limit,
    matchedChunks: matches.length,
    vectorMatches: vectorMatches.length,
    keywordMatches: keywordMatches.length,
  });

  await pool
    .query(
      "INSERT INTO retrieval_logs (tenant_id, query, top_k, matches) VALUES ($1::uuid, $2, $3, $4::jsonb)",
      [
        tenantId,
        encrypt(query),
        limit,
        JSON.stringify(
          matches.map((match) => ({
            chunkId: match.chunkId,
            documentId: match.documentId,
            title: match.title,
            score: match.score,
          })),
        ),
      ],
    )
    .catch((error) => {
      retrievalLogger.warn({
        msg: "Failed to persist retrieval log",
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return matches;
};

const fetchKeywordMatches = async (
  tenantId: string,
  terms: string[],
  limit: number,
): Promise<RetrievedChunk[]> => {
  if (!terms.length) {
    return [];
  }

  const patterns = terms.map((term) => `%${term}%`);

  const keywordQuery = [
    "SELECT",
    'pc.id AS "chunkId",',
    'pc.document_id AS "documentId",',
    'pd.title AS "title",',
    'pc.content AS "content",',
    'pd.source_url AS "sourceUrl",',
    'pc.chunk_index AS "chunkIndex"',
    "FROM policy_chunks pc",
    "INNER JOIN policy_documents pd ON pd.id = pc.document_id",
    "WHERE pd.tenant_id = $1::uuid",
    "AND pd.status = 'ready'",
    "AND (LOWER(pc.content) LIKE ANY($2::text[]) OR LOWER(pd.title) LIKE ANY($2::text[]))",
    "LIMIT $3",
  ].join(" ");

  const result = await pool.query<RetrievedChunkRow>(keywordQuery, [
    tenantId,
    patterns,
    limit * 4,
  ]);

  return result.rows
    .map((row) => {
      const haystack = `${row.title}\n${row.content}`.toLowerCase();
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const score = Math.min(
        0.92,
        0.45 + (matchedTerms.length / Math.max(terms.length, 1)) * 0.5,
      );

      return {
        chunkId: row.chunkId,
        documentId: row.documentId,
        title: row.title,
        content: row.content,
        score,
        sourceUrl: row.sourceUrl,
        chunkIndex: Number(row.chunkIndex),
      };
    })
    .filter(
      (row) => row.content.length > 0 && row.score >= config.RAG_MIN_SCORE,
    );
};

const mergeMatches = (
  vectorMatches: RetrievedChunk[],
  keywordMatches: RetrievedChunk[],
): RetrievedChunk[] => {
  const merged = new Map<string, RetrievedChunk>();

  for (const match of vectorMatches) {
    merged.set(match.chunkId, match);
  }

  for (const match of keywordMatches) {
    const existing = merged.get(match.chunkId);
    if (!existing || match.score > existing.score) {
      merged.set(match.chunkId, match);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.score - a.score);
};
