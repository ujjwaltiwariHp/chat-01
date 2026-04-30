import assert from "node:assert/strict";
import { classifyIntent } from "../services/intent-classifier.js";
import { matchFAQ } from "../data/hr-faq.js";
import { splitIntoChunks } from "../services/document-ingestion.service.js";
import { extractQueryTerms } from "../services/retrieval.service.js";
import {
  buildPolicyClarification,
  resolvePolicyTopicMatches,
} from "../services/policy-topics.js";

const run = () => {
  assert.equal(classifyIntent("hello"), "greeting");
  assert.equal(classifyIntent("thanks"), "thanks");
  assert.equal(
    classifyIntent("can you help me with leave policy"),
    "policy_query",
  );

  const faq = matchFAQ("How many working hours do we have?");
  assert.ok(faq);
  assert.match(faq!.answer, /40 hours/i);

  const topics = resolvePolicyTopicMatches("security");
  assert.ok(topics.includes("IT and Data Security"));

  const clarification = buildPolicyClarification([
    "Leave Deduction and Salary",
    "Sandwich Leave",
  ]);
  assert.match(clarification, /1\. Leave Deduction and Salary/);
  assert.match(clarification, /2\. Sandwich Leave/);

  const terms = extractQueryTerms(
    "What is the notice period and termination process?",
  );
  assert.ok(terms.includes("notice"));
  assert.ok(terms.includes("termination"));

  const chunks = splitIntoChunks(
    "Heading\n\nSection A line 1\nSection A line 2\n\nSection B line 1\nSection B line 2",
    50,
    10,
  );
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 50));

  console.log("HR policy behavior checks passed");
};

run();
