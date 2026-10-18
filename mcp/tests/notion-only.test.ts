import { test } from "node:test";
import assert from "node:assert/strict";
import { checkToolScope, validScopes, validPkceVerifier } from "../src/auth.js";

test("read tokens cannot mutate Notion", () => {
  for (const tool of ["create_task", "update_task", "request_approval", "start_workflow", "advance_workflow", "log_agent_run"])
    assert.equal(checkToolScope("artist_os:read", tool), false);
  for (const tool of ["get_artist_context", "get_operating_snapshot", "get_workflow", "get_workflow_run", "route_workflow"])
    assert.equal(checkToolScope("artist_os:read", tool), true);
});
test("legacy tools and unknown tools are always denied", () => {
  for (const tool of ["run_ai_ceo", "get_ai_request", "get_recent_changes", "create_contact", "unknown_future_tool"])
    assert.equal(checkToolScope("artist_os:read artist_os:write", tool), false);
  assert.equal(checkToolScope("artist_os:write", "get_artist_context"), false);
});
test("scope and PKCE inputs are validated", () => {
  assert.equal(validScopes("artist_os:admin"), false);
  assert.equal(validScopes("artist_os:read artist_os:write"), true);
  assert.equal(validPkceVerifier("short"), false);
  assert.equal(validPkceVerifier("a".repeat(43)), true);
});
