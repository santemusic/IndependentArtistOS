import { test } from "node:test";
import assert from "node:assert/strict";
import { checkToolScope, validScopes, validPkceVerifier } from "../src/auth.js";
import { executeClaim, type Claim } from "../src/worker.js";
import { ceoJsonSchema } from "../src/ceo-schema.js";

const response = { current_state: { summary: "Test", facts_used: [] }, diagnosis: { primary_bottleneck: "Test", evidence: [], confidence: 0.5 }, actions: [], missing_data: [], notes: [] };
const claim: Claim = { claimed: true, request_id: "test-request", artist_workspace_id: "test-workspace", intent: "weekly", context: {}, request_payload: { system_rules: [], response_schema: ceoJsonSchema } };
test("read-only token denies consequential tools and unknown future tools", () => {
  for (const tool of ["run_ai_ceo", "create_task", "update_task", "unknown_future_tool"]) assert.equal(checkToolScope("artist_os:read", tool), false);
  assert.equal(checkToolScope("artist_os:read", "get_ai_request"), true);
  assert.equal(checkToolScope("artist_os:write", "get_ai_request"), false);
  assert.equal(checkToolScope("artist_os:read artist_os:write", "run_ai_ceo"), true);
  assert.equal(validScopes("artist_os:admin"), false);
  assert.equal(validPkceVerifier("short"), false);
  assert.equal(validPkceVerifier("a".repeat(43)), true);
});
test("unclaimed requests never call model or database", async () => {
  await executeClaim({ rpc: async () => { throw new Error("unexpected"); } }, { generate: async () => { throw new Error("unexpected"); } }, { ...claim, claimed: false });
});
test("malformed model output never reaches completion", async () => {
  const calls: string[] = [];
  await executeClaim({ rpc: async <T>(name: string) => { calls.push(name); return {} as T; } }, { generate: async () => ({ response: {}, provider: "OPENAI", model: "test" }) }, claim);
  assert.deepEqual(calls, ["fail_ai_gateway_request"]);
});
test("uncertain completion retries database without another paid model call", async () => {
  let modelCalls = 0; let dbCalls = 0;
  await executeClaim({ rpc: async <T>(name: string) => { assert.equal(name, "complete_ai_gateway_request"); if (++dbCalls === 1) throw new Error("timeout after commit"); return {} as T; } }, { generate: async () => { modelCalls++; return { response, provider: "OPENAI", model: "test" }; } }, claim);
  assert.equal(modelCalls, 1); assert.equal(dbCalls, 2);
});
test("two uncertain completions never mark potentially committed success as failed", async () => {
  const calls: string[] = [];
  await assert.rejects(executeClaim({ rpc: async (name: string) => { calls.push(name); throw new Error("timeout"); } }, { generate: async () => ({ response, provider: "OPENAI", model: "test" }) }, claim), /COMPLETION_UNCONFIRMED/);
  assert.deepEqual(calls, ["complete_ai_gateway_request", "complete_ai_gateway_request"]);
});
test("provider errors are redacted before database storage", async () => {
  await executeClaim({ rpc: async <T>(name: string, body: unknown) => { assert.equal(name, "fail_ai_gateway_request"); assert.equal(JSON.stringify(body).includes("sk-secret"), false); return {} as T; } }, { generate: async () => { throw new Error("sk-secret"); } }, claim);
});
