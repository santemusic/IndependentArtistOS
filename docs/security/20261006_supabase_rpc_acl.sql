-- Applied to BYD2 Supabase backend on 2026-10-06.
-- Emergency ACL hardening; no table or business-data changes.
-- This is an applied change record, not an automatically executed MCP migration.
-- Reconcile into the canonical BYD2 backend migration history before redeploying its schema.
-- Remove PUBLIC as well as anon: privileges inherited from PUBLIC would otherwise remain.
-- Existing authenticated grants are preserved except for global server-only maintenance.
-- Existing service_role and owner grants are preserved; nested SECURITY DEFINER calls
-- made by the token-validating gateway retain owner permissions.
-- Verified: all 28 deny anon; two maintenance functions deny authenticated;
-- all retain service_role access. Rolled-back role tests confirmed anonymous denial,
-- nonmember denial, maintenance denial for authenticated, and service runtime read.
-- This does not certify the queue worker, kill switch or concurrency behavior.

BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE EXECUTE ON FUNCTION public.can_execute_action(_ws uuid, _action_key text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_agent_run(_run uuid, _status text, _diagnosis jsonb, _plan jsonb, _result jsonb, _error text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_agent_task(_ws uuid, _title text, _priority text, _due_date date, _next_action text, _source_agent text, _project_id uuid, _approval_state text, _assigned_entity_type text, _assigned_entity_name text, _fingerprint text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.emit_workflow_event(_ws uuid, _event_type text, _payload jsonb, _related_object_type text, _related_object_id uuid, _idempotency_key text, _source text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_scheduled_workflows(_now timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_artist_runtime(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_artist_operating_readiness(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_equivalent_action(_ws uuid, _fingerprint text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_research_answer_suggestions(_research_run_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_artist_context(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_artist_onboarding_dashboard(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_onboarding_template_state(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_operating_snapshot(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_partner_execution_brief(_ws uuid, _partner_id uuid, _task_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_research_mapping_review(_research_run_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_runtime_control(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_system_health(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.initialize_artist_onboarding(_ws uuid, _template_key text, _version integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_agent_run(_ws uuid, _agent_key text, _workflow_key text, _status text, _fingerprint text, _provider text, _model text, _payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_runtime_event(_ws uuid, _component text, _entity_type text, _entity_id uuid, _event_type text, _severity text, _summary text, _metadata jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_completed_artist_research(_research_run_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_all_approved_second_brain_candidates(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_second_brain_candidate(_candidate_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recover_stale_runtime_jobs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_external_action_readiness(_approval_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_second_brain_candidates(_ws uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_approval(_ws uuid, _title text, _description text, _action_type text, _action_payload jsonb, _source_agent text, _run_id uuid, _fingerprint text, _due_date date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_ai_provider(_ws uuid, _provider_override text, _model_override text) FROM PUBLIC, anon;
COMMIT;

-- Verification (expect anon_exec=false on all rows; user_exec=false for maintenance).
SELECT p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS user_exec,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS server_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'can_execute_action',
  'complete_agent_run',
  'create_agent_task',
  'emit_workflow_event',
  'enqueue_scheduled_workflows',
  'ensure_artist_runtime',
  'evaluate_artist_operating_readiness',
  'find_equivalent_action',
  'generate_research_answer_suggestions',
  'get_artist_context',
  'get_artist_onboarding_dashboard',
  'get_onboarding_template_state',
  'get_operating_snapshot',
  'get_partner_execution_brief',
  'get_research_mapping_review',
  'get_runtime_control',
  'get_system_health',
  'initialize_artist_onboarding',
  'log_agent_run',
  'log_runtime_event',
  'process_completed_artist_research',
  'promote_all_approved_second_brain_candidates',
  'promote_second_brain_candidate',
  'recover_stale_runtime_jobs',
  'refresh_external_action_readiness',
  'refresh_second_brain_candidates',
  'request_approval',
  'resolve_ai_provider'
)
ORDER BY p.proname;
