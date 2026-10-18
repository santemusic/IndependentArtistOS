const scopes = new Set(["artist_os:read", "artist_os:write", "offline_access"]);
const reads = new Set([
  "list_artists", "get_artist_context", "get_operating_snapshot", "get_runtime_control",
  "get_workflow", "get_workflow_run", "route_workflow",
]);
const writes = new Set([
  "create_task", "update_task", "request_approval", "log_agent_run",
  "start_workflow", "advance_workflow",
]);
export function validScopes(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.split(/\s+/).every((s) => scopes.has(s));
}
export function checkToolScope(value: string, tool: unknown): boolean {
  if (!validScopes(value) || typeof tool !== "string") return false;
  const granted = new Set(value.split(/\s+/));
  if (reads.has(tool)) return granted.has("artist_os:read");
  if (writes.has(tool)) return granted.has("artist_os:write");
  return false;
}
export function validPkceVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}
