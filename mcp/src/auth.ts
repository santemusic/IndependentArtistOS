const scopes = new Set(["artist_os:read", "artist_os:write", "offline_access"]);
const reads = new Set(["get_artist_context", "get_operating_snapshot", "get_recent_changes", "list_tasks", "search_contacts", "get_contact", "search_opportunities", "get_discovery_status", "get_runtime_control", "get_second_brain_context", "get_system_health", "get_positioning_summary", "get_research_status", "get_research_findings", "get_onboarding_prefill_summary", "list_ai_agents", "list_workflows", "get_ai_request", "get_workflow", "get_workflow_run"]);
export function validScopes(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.split(/\s+/).every(s => scopes.has(s));
}
export function checkToolScope(value: string, tool: unknown): boolean {
  if (!validScopes(value) || typeof tool !== "string") return false;
  const granted = new Set(value.split(/\s+/));
  return granted.has(reads.has(tool) ? "artist_os:read" : "artist_os:write");
}
export function validPkceVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}
