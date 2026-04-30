import { ApiError, logger } from "@hp-intelligence/core";
import { config } from "@/config/index.js";
import { pool } from "@/db/connection.js";
import { formatVector } from "@/lib/pgvector.js";
import { embedTexts } from "@/services/embedding.service.js";
import { PolicyDocumentInput } from "@/types/rag.js";

const ingestionLogger = logger.child({ ns: "hr-policy:ingestion" });

interface IngestPolicyDocumentInput extends PolicyDocumentInput {
  tenantId: string;
}

interface DocumentRow {
  id: string;
}

export const ingestPolicyDocument = async (
  input: IngestPolicyDocumentInput,
) => {
  const title = input.title.trim();
  const content = input.content.trim();
  const sourceKey = input.sourceKey.trim();

  if (!title || !content || !sourceKey) {
    throw new ApiError(
      "COMMON_VALIDATION_ERROR",
      "title, content, and sourceKey are required",
    );
  }

  const chunks = splitIntoChunks(
    content,
    config.RAG_CHUNK_SIZE,
    config.RAG_CHUNK_OVERLAP,
  );

  if (!chunks.length) {
    throw new ApiError(
      "COMMON_VALIDATION_ERROR",
      "No policy chunks were generated from the provided content",
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const documentUpsertQuery = [
      "INSERT INTO policy_documents (tenant_id, source_key, title, source_url, status, metadata, updated_at)",
      "VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, NOW())",
      "ON CONFLICT (tenant_id, source_key)",
      "DO UPDATE SET",
      "title = EXCLUDED.title,",
      "source_url = EXCLUDED.source_url,",
      "status = EXCLUDED.status,",
      "metadata = EXCLUDED.metadata,",
      "updated_at = NOW()",
      "RETURNING id",
    ].join(" ");

    const documentResult = await client.query<DocumentRow>(
      documentUpsertQuery,
      [
        input.tenantId,
        sourceKey,
        title,
        input.sourceUrl ?? null,
        "ready",
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    const documentId = documentResult.rows[0]?.id;

    if (!documentId) {
      throw new ApiError(
        "DB_QUERY_FAILED",
        "Document ingestion failed to create or update the policy record",
      );
    }

    await client.query(
      "DELETE FROM policy_chunks WHERE document_id = $1::uuid",
      [documentId],
    );

    const embeddings = await embedTexts(chunks);

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const embedding = embeddings[index];

      await client.query(
        [
          "INSERT INTO policy_chunks (document_id, chunk_index, content, token_count, embedding_model, embedding)",
          "VALUES ($1::uuid, $2, $3, $4, $5, $6::vector)",
        ].join(" "),
        [
          documentId,
          index,
          chunk,
          estimateTokenCount(chunk),
          config.RAG_EMBEDDING_MODEL,
          formatVector(embedding),
        ],
      );
    }

    await client.query("COMMIT");

    ingestionLogger.info({
      msg: "Policy document ingested",
      tenantId: input.tenantId,
      sourceKey,
      documentId,
      chunks: chunks.length,
    });

    return {
      documentId,
      chunksIngested: chunks.length,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const splitIntoChunks = (
  content: string,
  chunkSize: number,
  overlap: number,
): string[] => {
  const normalized = content.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flushCurrent = () => {
    const chunk = current.trim();
    if (chunk) {
      chunks.push(chunk);
    }
    current = "";
  };

  for (const block of blocks) {
    if (block.length > chunkSize) {
      flushCurrent();
      chunks.push(...splitLargeBlock(block, chunkSize, overlap));
      continue;
    }

    const separator = current ? "\n\n" : "";
    if ((current + separator + block).length <= chunkSize) {
      current = `${current}${separator}${block}`;
      continue;
    }

    flushCurrent();
    current = block;
  }

  flushCurrent();

  return chunks;
};

const splitLargeBlock = (
  block: string,
  chunkSize: number,
  overlap: number,
): string[] => {
  const lines = block.split("\n").map((line) => line.trimEnd());
  const result: string[] = [];
  let current = "";

  for (const line of lines) {
    const separator = current ? "\n" : "";
    if ((current + separator + line).length <= chunkSize) {
      current = `${current}${separator}${line}`;
      continue;
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    if (line.length > chunkSize) {
      let cursor = 0;
      while (cursor < line.length) {
        const end = Math.min(cursor + chunkSize, line.length);
        result.push(line.slice(cursor, end).trim());
        if (end >= line.length) {
          break;
        }
        cursor = Math.max(end - overlap, cursor + 1);
      }
      current = "";
    } else {
      current = line;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
};

const estimateTokenCount = (content: string): number =>
  Math.ceil(content.length / 4);
