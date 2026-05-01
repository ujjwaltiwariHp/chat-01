import { randomUUID } from "crypto";
import type { ChatMessage } from "@hp-intelligence/core";
import {
  AuthError,
  checkAndDeductCredits,
  countChatTokens,
  countTokens,
  createAIBillingEvent,
  finalizeAIBillingEvent,
  logger,
  refundTenantCredits,
  reserveTenantCredits,
} from "@hp-intelligence/core";
import { config } from "@/config/index.js";
import { db } from "@/db/connection.js";
import { PROMPT_VERSION, systemPrompt } from "@/prompts/system.v1.js";
import { hrPolicyOpenAIProvider } from "@/ai/openai-provider.js";
import { retrievePolicyContext } from "@/services/retrieval.service.js";
import { PolicyAnswer, PolicyQuestionInput } from "@/types/rag.js";
import { classifyIntent, STATIC_RESPONSES } from "./intent-classifier.js";
import { matchFAQ } from "../data/hr-faq.js";
import {
  buildPolicyClarification,
  resolvePolicyTopicMatches,
} from "@/services/policy-topics.js";

const buildRetrievalQuery = (
  message: string,
  history: ChatMessage[] = [],
): string => {
  const recentHistory = history
    .slice(-4)
    .map((entry) => `${entry.role}: ${entry.content.trim()}`)
    .filter(Boolean);

  if (!recentHistory.length) {
    return message;
  }

  return [
    "Conversation history:",
    ...recentHistory,
    "Current question:",
    message,
  ].join("\n");
};

const buildHistoryForCompletion = (
  history: ChatMessage[] = [],
): ChatMessage[] =>
  history.slice(-config.POLICY_HISTORY_LIMIT).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

const policyChatLogger = logger.child({ ns: "hr-policy:chat" });

const buildAnswerPrompt = (message: string, contextBlock: string): string =>
  [
    "Use the retrieved policy context below to answer the question accurately.",
    "Do not invent policy details.",
    "If context is partial, provide known details, clearly mark what is not specified, and offer practical guidance as non-policy guidance.",
    "",
    "Prompt version:",
    PROMPT_VERSION,
    "",
    "Question:",
    message,
    "",
    "Retrieved policy context:",
    contextBlock,
    "",
    "Respond with a concise answer and cite the supporting policy title inline.",
  ].join("\n");

const shouldPreferFaq = (message: string): boolean => {
  const normalized = message.trim().toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const deepIntent = /(explain|everything|full|detailed|details|all conditions|all rules|compare|difference|why)/i;
  return wordCount <= 12 && !deepIntent.test(normalized);
};

const buildNaturalFallback = (message: string): string => {
  const lower = message.toLowerCase();
  if (/(maternity|paternity|bonus|gratuity)/i.test(lower)) {
    return "I could not find this topic in the current policy set. I can share related policy areas if helpful, or you can confirm the official rule with HR at hr@hangingpanda.com.";
  }
  return "I can share what our policy clearly states if you tell me the exact topic (for example leave balance, probation notice period, NCNS, sandwich leave, increment eligibility, or mobile device use).";
};

export const answerPolicyQuestion = async (
  input: PolicyQuestionInput,
): Promise<PolicyAnswer> => {
  const intent = classifyIntent(input.message);

  if (intent !== "policy_query") {
    return {
      answer: STATIC_RESPONSES[intent],
      citations: [],
      matches: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      retrievalQuery: input.message,
    };
  }

  const faqMatch = matchFAQ(input.message, input.history || []);
  if (faqMatch && shouldPreferFaq(input.message)) {
    return {
      answer: faqMatch.answer,
      citations: [
        {
          chunkId: "faq",
          documentId: "faq",
          title: faqMatch.policyArea,
          sourceUrl: null,
          score: 1.0,
        },
      ],
      matches: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      retrievalQuery: input.message,
    };
  }

  const retrievalQuery = buildRetrievalQuery(input.message, input.history);
  const STRONG_MATCH_THRESHOLD = config.RAG_MIN_SCORE;
  const topicMatches = resolvePolicyTopicMatches(input.message);
  const matches = await retrievePolicyContext(input.tenantId, retrievalQuery);
  const strongMatches = matches.filter(
    (m) => m.score >= STRONG_MATCH_THRESHOLD,
  );

  if (strongMatches.length === 0) {
    if (faqMatch) {
      return {
        answer: faqMatch.answer,
        citations: [
          {
            chunkId: "faq",
            documentId: "faq",
            title: faqMatch.policyArea,
            sourceUrl: null,
            score: 1.0,
          },
        ],
        matches: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        retrievalQuery: input.message,
      };
    }

    if (topicMatches.length > 0) {
      return {
        answer: buildPolicyClarification(topicMatches),
        citations: [],
        matches: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        retrievalQuery,
      };
    }

    return {
      answer: buildNaturalFallback(input.message),
      citations: [],
      matches: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      retrievalQuery,
    };
  }

  const contextBlock =
    strongMatches.length > 0
      ? strongMatches
          .map((match, index) =>
            [
              "Source " + String(index + 1) + ": " + match.title,
              "Score: " + match.score.toFixed(4),
              match.sourceUrl ? "URL: " + match.sourceUrl : "URL: not provided",
              "Excerpt:",
              match.content,
            ].join("\n"),
          )
          .join("\n\n")
      : "NO RELEVANT POLICY CONTEXT FOUND.";
  const model = config.RAG_CHAT_MODEL || config.OPENAI_MODEL;
  const historyForCompletion = buildHistoryForCompletion(input.history);
  const userMessage = buildAnswerPrompt(input.message, contextBlock);
  const requestId = input.requestId || randomUUID();

  let reservedTokens = 0;
  let responseReceived = false;

  try {
    const requestedCompletionTokens = config.MAX_MESSAGE_TOKENS;
    const estimatedPromptTokens = countChatTokens(
      systemPrompt,
      userMessage,
      historyForCompletion,
      model,
    );
    const requestedTokenBudget =
      estimatedPromptTokens + requestedCompletionTokens;
    const reservation = await reserveTenantCredits(
      db,
      input.tenantId,
      requestedTokenBudget,
    );
    reservedTokens = reservation.reserved;

    await createAIBillingEvent(db, {
      requestId,
      tenantId: input.tenantId,
      service: "hr-policy",
      operation: "policy-chat",
      model,
      estimatedPromptTokens,
      requestedCompletionTokens,
      requestedTokenBudget,
      reservedTokens,
      metadata: {
        historyLength: historyForCompletion.length,
        matchedChunks: strongMatches.length,
        retrievalQuery,
      },
      status: reservedTokens > 0 ? "reserved" : "refunded",
      requestOutcome: reservedTokens > 0 ? "pending" : "failed",
      errorMessage: reservedTokens > 0 ? undefined : "Insufficient AI credits",
    });

    const remainingCompletionBudget =
      reservation.reserved - estimatedPromptTokens;
    const dynamicMaxTokens = Math.max(
      1,
      Math.min(requestedCompletionTokens, remainingCompletionBudget),
    );

    if (reservedTokens <= 0) {
      throw new AuthError(
        "Insufficient AI credits",
        "AUTH_INSUFFICIENT_CREDITS",
      );
    }

    policyChatLogger.info(
      {
        tenantId: input.tenantId,
        requestId,
        estimatedPromptTokens,
        requestedCompletionTokens,
        requestedTokenBudget,
        reservedTokens,
        remainingCredits: reservation.remaining,
        dynamicMaxTokens,
        matchedChunks: strongMatches.length,
      },
      "Tenant credits reserved for HR policy response",
    );

    const completion = await hrPolicyOpenAIProvider.complete({
      model,
      systemPrompt,
      history: historyForCompletion,
      userMessage,
      maxTokens: dynamicMaxTokens,
      temperature: 0.1,
      signal: input.signal,
    });
    responseReceived = true;

    const actualTotalTokens =
      completion.usage.totalTokens > 0
        ? completion.usage.totalTokens
        : estimatedPromptTokens + countTokens(completion.content || "", model);
    const tokensToRefund = Math.max(0, reservedTokens - actualTotalTokens);
    const additionalTokensToCharge = Math.max(
      0,
      actualTotalTokens - reservedTokens,
    );

    if (tokensToRefund > 0) {
      await refundTenantCredits(db, input.tenantId, tokensToRefund);
    }

    let additionalChargedTokens = 0;
    if (additionalTokensToCharge > 0) {
      try {
        await checkAndDeductCredits(
          db,
          input.tenantId,
          additionalTokensToCharge,
        );
        additionalChargedTokens = additionalTokensToCharge;
      } catch (billingError: any) {
        policyChatLogger.warn(
          {
            tenantId: input.tenantId,
            requestId,
            actualTotalTokens,
            reservedTokens,
            additionalTokensToCharge,
            error: billingError.message,
          },
          "Actual token usage exceeded reservation; additional charge could not be captured",
        );
      }
    }

    await finalizeAIBillingEvent(db, {
      requestId,
      status: "settled",
      requestOutcome: "succeeded",
      actualPromptTokens: completion.usage.promptTokens,
      actualCompletionTokens: completion.usage.completionTokens,
      actualTotalTokens,
      refundedTokens: tokensToRefund,
      additionalChargedTokens,
      uncollectedTokens: Math.max(
        0,
        additionalTokensToCharge - additionalChargedTokens,
      ),
      errorMessage: null,
    });

    policyChatLogger.info(
      {
        tenantId: input.tenantId,
        requestId,
        reservedTokens,
        actualTotalTokens,
        refundedTokens: tokensToRefund,
        additionalChargedTokens,
      },
      "Tenant token reservation settled for HR policy response",
    );

    return {
      answer:
        completion.content ||
        "I could not generate an answer from the retrieved policy context.",
      citations: strongMatches.map((match) => ({
        chunkId: match.chunkId,
        documentId: match.documentId,
        title: match.title,
        sourceUrl: match.sourceUrl,
        score: match.score,
      })),
      matches: strongMatches,
      usage: completion.usage,
      retrievalQuery,
    };
  } catch (error: any) {
    if (reservedTokens > 0 && !responseReceived) {
      try {
        await refundTenantCredits(db, input.tenantId, reservedTokens);
      } catch (refundError: any) {
        policyChatLogger.error(
          {
            tenantId: input.tenantId,
            requestId,
            reservedTokens,
            error: refundError.message,
          },
          "Failed to refund reserved tokens after pre-response failure",
        );
      }

      try {
        await finalizeAIBillingEvent(db, {
          requestId,
          status: "refunded",
          requestOutcome: "failed",
          refundedTokens: reservedTokens,
          errorMessage: error.message || "Provider call failed before response",
        });
      } catch (billingFinalizeError: any) {
        policyChatLogger.error(
          {
            tenantId: input.tenantId,
            requestId,
            error: billingFinalizeError.message,
          },
          "Failed to finalize billing event after pre-response refund",
        );
      }
    }

    throw error;
  }
};
