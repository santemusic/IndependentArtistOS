-- BYD2 execution hardening. Applied separately; no MCP auto-migration.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE UNIQUE INDEX IF NOT EXISTS tasks_active_fingerprint_uq ON public.tasks(artist_workspace_id,action_fingerprint) WHERE action_fingerprint IS NOT NULL AND status<>'DONE';
CREATE UNIQUE INDEX IF NOT EXISTS approvals_pending_fingerprint_uq ON public.approvals(artist_workspace_id,action_fingerprint) WHERE action_fingerprint IS NOT NULL AND status='pending';

CREATE OR REPLACE FUNCTION public._assert_runtime_write(_ws uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE rt public.automation_control;
BEGIN
 IF _ws IS NULL THEN RAISE EXCEPTION 'Workspace required'; END IF;
 INSERT INTO public.automation_control(artist_workspace_id) VALUES(_ws) ON CONFLICT DO NOTHING;
 SELECT * INTO rt FROM public.automation_control WHERE artist_workspace_id=_ws FOR UPDATE;
 IF rt.kill_switch OR rt.global_mode='PAUSED' THEN RAISE EXCEPTION 'Runtime blocked'; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public._assert_runtime_write(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.create_agent_task(_ws uuid, _title text, _priority text DEFAULT 'MEDIUM'::text, _due_date date DEFAULT NULL::date, _next_action text DEFAULT NULL::text, _source_agent text DEFAULT NULL::text, _project_id uuid DEFAULT NULL::uuid, _approval_state text DEFAULT 'NOT_REQUIRED'::text, _assigned_entity_type text DEFAULT 'AI_AGENT'::text, _assigned_entity_name text DEFAULT NULL::text, _fingerprint text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tid uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    if auth.uid() is null then raise exception 'Not authenticated'; end if;
    if not public.is_workspace_member(_ws) then raise exception 'Not a member of this workspace'; end if;
  end if;
  perform public._assert_runtime_write(_ws);
  if _project_id is not null and not exists(select 1 from public.projects where id=_project_id and artist_workspace_id=_ws) then raise exception 'Project belongs to another workspace'; end if;
  if _fingerprint is not null then
    perform pg_advisory_xact_lock(hashtextextended(_ws::text || '|' || _fingerprint, 0));
    select id into tid from public.tasks where artist_workspace_id=_ws and action_fingerprint=_fingerprint and status<>'DONE' limit 1;
    if tid is not null then return tid; end if;
  end if;
  insert into public.tasks(artist_workspace_id,title,priority,due_date,next_action,source_agent,project_id,approval_state,assigned_entity_type,assigned_entity_name,action_fingerprint,operator,status)
  values(
    _ws,left(_title,500),coalesce(_priority,'MEDIUM'),_due_date,_next_action,_source_agent,_project_id,
    coalesce(_approval_state,'NOT_REQUIRED'),_assigned_entity_type,_assigned_entity_name,_fingerprint,
    case when _assigned_entity_type='ARTIST' then 'ARTIST'
         when _assigned_entity_type='HUMAN' then 'HUMAN'
         when _assigned_entity_type='AGENCY' then 'AGENCY'
         else 'AI' end,
    'NEXT'
  ) returning id into tid;
  return tid;
end $function$
;
CREATE OR REPLACE FUNCTION public.request_approval(_ws uuid, _title text, _description text, _action_type text, _action_payload jsonb, _source_agent text, _run_id uuid DEFAULT NULL::uuid, _fingerprint text DEFAULT NULL::text, _due_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare aid uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    if auth.uid() is null then raise exception 'Not authenticated'; end if;
    if not public.is_workspace_member(_ws) then raise exception 'Not a member of this workspace'; end if;
  end if;
  perform public._assert_runtime_write(_ws);
  if _run_id is not null and not exists(select 1 from public.agent_runs where id=_run_id and artist_workspace_id=_ws) then raise exception 'Run belongs to another workspace'; end if;
  if _fingerprint is not null then
    perform pg_advisory_xact_lock(hashtextextended(_ws::text || '|' || _fingerprint, 0));
    select id into aid from public.approvals where artist_workspace_id=_ws and action_fingerprint=_fingerprint and status='pending' limit 1;
    if aid is not null then return aid; end if;
  end if;
  insert into public.approvals(
    artist_workspace_id,title,description,status,requested_by,due_date,
    action_fingerprint,action_type,action_payload,source_agent,agent_run_id
  )
  values(
    _ws,left(_title,500),_description,'pending',_source_agent,_due_date,
    _fingerprint,_action_type,coalesce(_action_payload,'{}'::jsonb),_source_agent,_run_id
  ) returning id into aid;
  return aid;
end $function$
;
CREATE OR REPLACE FUNCTION public.begin_ai_gateway_request(_ws uuid, _intent text, _user_message text DEFAULT NULL::text, _provider_override text DEFAULT NULL::text, _model_override text DEFAULT NULL::text, _contract_key text DEFAULT 'ceo-manager-v1'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  rt jsonb;
  ctx jsonb;
  prov jsonb;
  fp text;
  existing uuid;
  runid uuid;
  reqid uuid;
  week_key text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_workspace_member(_ws) then raise exception 'Not a member of this workspace'; end if;

  perform public._assert_runtime_write(_ws);
  rt := public.get_runtime_control(_ws);
  if coalesce((rt->>'kill_switch')::boolean,false) then raise exception 'Runtime blocked: kill switch enabled'; end if;
  if coalesce(rt->>'global_mode','SUPERVISED') = 'PAUSED' then raise exception 'Runtime blocked: global mode paused'; end if;

  if not exists(select 1 from public.ai_gateway_contracts where contract_key=_contract_key and active) then
    raise exception 'Unknown or inactive AI contract';
  end if;

  ctx := public.get_artist_context(_ws);
  prov := public.resolve_ai_provider(_ws,_provider_override,_model_override);
  if coalesce((prov->>'available')::boolean,false)=false then
    raise exception 'Requested AI provider/model is unavailable';
  end if;

  week_key := to_char(now() at time zone 'utc','IYYY-IW');
  fp := encode(digest(
    _ws::text || '|' || coalesce(_intent,'') || '|' || coalesce(_user_message,'') || '|' || _contract_key || '|' || prov::text || '|' ||
    coalesce(ctx#>>'{master_context,goal_90d}','') || '|' ||
    coalesce(ctx#>>'{master_context,bottleneck}','') || '|' ||
    week_key,
    'sha256'
  ),'hex');

  perform pg_advisory_xact_lock(hashtextextended(_ws::text || '|' || fp, 0));
  select id into existing
  from public.ai_gateway_requests
  where artist_workspace_id=_ws
    and idempotency_key=fp
    
  order by created_at desc limit 1;

  if existing is not null then return existing; end if;

  if (select count(*) from public.ai_gateway_requests where artist_workspace_id=_ws and created_at > now()-interval '1 hour') >= 10 then
    raise exception 'AI request limit reached; retry after the hourly window';
  end if;

  runid := public.log_agent_run(
    _ws,
    'ceo-manager',
    case
      when _intent='help_me_grow' then 'help-me-grow'
      when _intent='weekly' then 'weekly-ceo-review'
      when _intent='review_progress' then 'weekly-ceo-review'
      when _intent='plan_release' then 'release-countdown'
      else null
    end,
    'QUEUED',
    fp,
    prov->>'provider',
    prov->>'model',
    jsonb_build_object('intent',_intent,'contract_key',_contract_key)
  );

  insert into public.ai_gateway_requests(
    artist_workspace_id,agent_run_id,contract_key,intent,user_message,
    provider_requested,model_requested,provider_resolved,model_resolved,
    status,idempotency_key,context_snapshot,request_payload,created_by
  ) values (
    _ws,runid,_contract_key,left(_intent,100),left(_user_message,4000),
    _provider_override,_model_override,prov->>'provider',prov->>'model',
    'QUEUED',fp,ctx,
    jsonb_build_object(
      'system_rules',(select system_rules from public.ai_gateway_contracts where contract_key=_contract_key),
      'response_schema',(select response_schema from public.ai_gateway_contracts where contract_key=_contract_key),
      'intent',_intent,
      'user_message',left(_user_message,4000)
    ),
    auth.uid()
  )
  returning id into reqid;

  return reqid;
end $function$
;
CREATE OR REPLACE FUNCTION public.claim_ai_gateway_request(_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.ai_gateway_requests;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server only'; end if;

  select * into r from public.ai_gateway_requests where id=_request_id for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if r.status <> 'QUEUED' then
    return jsonb_build_object('claimed',false,'status',r.status);
  end if;

  BEGIN
    perform public._assert_runtime_write(r.artist_workspace_id);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Runtime blocked' THEN RAISE; END IF;
    update public.ai_gateway_requests set status='BLOCKED',error_code='RUNTIME_BLOCKED',error_message='Runtime paused or kill switch enabled',completed_at=now(),updated_at=now() where id=_request_id;
    perform public.complete_agent_run(r.agent_run_id,'BLOCKED',null,null,null,'Runtime blocked');
    return jsonb_build_object('claimed',false,'status','BLOCKED','request_id',r.id);
  END;

  update public.ai_gateway_requests
    set status='CLAIMED', claimed_at=now(), updated_at=now()
    where id=_request_id;

  update public.agent_runs
    set status='READING_CONTEXT', started_at=coalesce(started_at,now()), updated_at=now()
    where id=r.agent_run_id;

  return jsonb_build_object(
    'claimed',true,
    'request_id',r.id,
    'artist_workspace_id',r.artist_workspace_id,
    'agent_run_id',r.agent_run_id,
    'contract_key',r.contract_key,
    'intent',r.intent,
    'user_message',r.user_message,
    'provider',r.provider_resolved,
    'model',r.model_resolved,
    'context',r.context_snapshot,
    'request_payload',r.request_payload
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.complete_ai_gateway_request(_request_id uuid, _response jsonb, _provider_used text DEFAULT NULL::text, _model_used text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r public.ai_gateway_requests;
declare v jsonb;
declare a jsonb;
declare tid uuid;
declare aid uuid;
declare created_count int:=0;
declare approval_count int:=0;
declare reused_count int:=0;
declare task_fp text;
declare action_key text;
declare action_guard jsonb;
declare out_actions jsonb:='[]'::jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server only'; end if;

  select * into r from public.ai_gateway_requests where id=_request_id for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if r.status <> 'CLAIMED' then
    return jsonb_build_object('status',r.status,'request_id',r.id);
  end if;

  BEGIN
    perform public._assert_runtime_write(r.artist_workspace_id);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Runtime blocked' THEN RAISE; END IF;
    update public.ai_gateway_requests set status='BLOCKED',error_code='RUNTIME_BLOCKED',error_message='Runtime paused or kill switch enabled',completed_at=now(),updated_at=now() where id=_request_id;
    perform public.complete_agent_run(r.agent_run_id,'BLOCKED',null,null,null,'Runtime blocked');
    return jsonb_build_object('claimed',false,'status','BLOCKED','request_id',r.id);
  END;

  v := public.validate_ai_ceo_response(_response);
  if coalesce((v->>'valid')::boolean,false)=false then
    update public.ai_gateway_requests
      set status='FAILED', error_code='INVALID_MODEL_RESPONSE',
          error_message='Model returned an invalid structured response',
          response_payload=_response, completed_at=now(), updated_at=now()
      where id=_request_id;
    perform public.complete_agent_run(r.agent_run_id,'FAILED',null,null,null,'Invalid structured AI response');
    return jsonb_build_object('status','FAILED','validation',v);
  end if;

  for a in select * from jsonb_array_elements(_response->'actions') loop
    task_fp := encode(digest(r.idempotency_key || '|' || coalesce(a->>'title','') || '|' || coalesce(a->>'next_action',''),'sha256'),'hex');

    if coalesce((a->>'consequential')::boolean,false) then
      action_key := case coalesce(a->>'consequence_type','OTHER')
        when 'EMAIL' then 'external_email'
        when 'SOCIAL_PUBLISH' then 'social_publish'
        when 'SPEND' then 'spend'
        when 'BOOKING_ACCEPTANCE' then 'booking_acceptance'
        when 'CONTRACT_RIGHTS' then 'contracts_rights'
        when 'RELEASE_DATE_CHANGE' then 'release_date_change'
        when 'PUBLIC_STATEMENT' then 'social_publish'
        else 'external_email'
      end;
      action_guard := public.can_execute_action(r.artist_workspace_id,action_key);
    else
      action_guard := jsonb_build_object('allowed',true,'requires_approval',false,'reason','internal_action');
    end if;

    select id into tid
    from public.tasks
    where artist_workspace_id=r.artist_workspace_id and action_fingerprint=task_fp and status<>'DONE'
    limit 1;

    if tid is null then
      tid := public.create_agent_task(
        r.artist_workspace_id,
        a->>'title',
        a->>'priority',
        case when nullif(a->>'due_date','') is null then null else (a->>'due_date')::date end,
        a->>'next_action',
        'ceo-manager',
        null,
        case when coalesce((a->>'consequential')::boolean,false) then 'PENDING' else 'NOT_REQUIRED' end,
        a->>'owner_type',
        nullif(a->>'owner_name',''),
        task_fp
      );
      created_count:=created_count+1;
    else
      reused_count:=reused_count+1;
    end if;

    if coalesce((a->>'consequential')::boolean,false) then
      aid := public.request_approval(
        r.artist_workspace_id,
        a->>'title',
        a->>'why',
        coalesce(a->>'consequence_type','OTHER'),
        a,
        'ceo-manager',
        r.agent_run_id,
        task_fp || ':approval',
        case when nullif(a->>'due_date','') is null then null else (a->>'due_date')::date end
      );
      update public.tasks set approval_id=aid,approval_state='PENDING',updated_at=now() where id=tid;
      approval_count:=approval_count+1;
    end if;

    out_actions := out_actions || jsonb_build_array(
      a || jsonb_build_object(
        'task_id',tid,
        'approval_id',aid,
        'runtime',action_guard
      )
    );
    aid:=null;
  end loop;

  update public.ai_gateway_requests
    set status='SUCCEEDED',
        provider_resolved=coalesce(_provider_used,provider_resolved),
        model_resolved=coalesce(_model_used,model_resolved),
        response_payload=_response,
        completed_at=now(),
        updated_at=now()
    where id=_request_id;

  perform public.complete_agent_run(
    r.agent_run_id,
    'SUCCEEDED',
    _response->'diagnosis',
    jsonb_build_object('actions',_response->'actions','missing_data',_response->'missing_data'),
    jsonb_build_object('current_state',_response->'current_state','actions_written',out_actions,'notes',_response->'notes'),
    null
  );

  return jsonb_build_object(
    'status','SUCCEEDED',
    'request_id',r.id,
    'agent_run_id',r.agent_run_id,
    'created_tasks',created_count,
    'reused_tasks',reused_count,
    'approvals',approval_count,
    'actions',out_actions
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.fail_ai_gateway_request(_request_id uuid, _error_code text, _error_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.ai_gateway_requests;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server only'; end if;
  select * into r from public.ai_gateway_requests where id=_request_id for update;
  if r.id is null or r.status not in ('QUEUED','CLAIMED') then return; end if;

  update public.ai_gateway_requests
    set status='FAILED',
        error_code=left(coalesce(_error_code,'AI_GATEWAY_ERROR'),100),
        error_message=left(regexp_replace(coalesce(_error_message,'AI gateway failed'),'(?i)(api[_ -]?key|authorization|bearer|token)[^,;\n]*','[redacted]','g'),500),
        completed_at=now(),
        updated_at=now()
    where id=_request_id and status not in ('SUCCEEDED','CANCELLED');

  perform public.complete_agent_run(r.agent_run_id,'FAILED',null,null,null,'AI gateway failed; inspect sanitized request error');
end $function$
;
CREATE OR REPLACE FUNCTION public.recover_stale_runtime_jobs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare w int:=0;
declare a int:=0;
declare k int:=0;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server only'; end if;

  update public.workflow_jobs
  set status=case when attempt<max_attempts then 'QUEUED' else 'FAILED' end,
      not_before=now()+interval '5 minutes',
      error_message='Recovered stale claimed workflow job',
      claimed_at=null,
      completed_at=case when attempt>=max_attempts then now() else null end,
      updated_at=now()
  where status='CLAIMED' and claimed_at < now()-interval '15 minutes';
  get diagnostics w=row_count;

  update public.ai_gateway_requests
  set status='FAILED',
      error_code='STALE_WORKER',
      error_message='AI worker did not complete in time',
      completed_at=now(),
      updated_at=now()
  where status='CLAIMED' and claimed_at < now()-interval '10 minutes';
  get diagnostics a=row_count;
  update public.agent_runs ar set status='FAILED',error='AI worker did not complete in time',completed_at=now(),updated_at=now() from public.ai_gateway_requests q where q.agent_run_id=ar.id and q.status='FAILED' and q.error_code='STALE_WORKER' and ar.status not in ('SUCCEEDED','CANCELLED');

  update public.knowledge_ingestion_jobs
  set status=case when attempt<max_attempts then 'QUEUED' else 'FAILED' end,
      error_message='Recovered stale knowledge ingestion job',
      claimed_at=null,
      completed_at=case when attempt>=max_attempts then now() else null end,
      updated_at=now()
  where status='PROCESSING' and claimed_at < now()-interval '20 minutes';
  get diagnostics k=row_count;

  return jsonb_build_object('workflow_jobs',w,'ai_requests',a,'knowledge_jobs',k);
end $function$
;
CREATE OR REPLACE FUNCTION public.mcp_gateway_call(_token_hash text, _operation text, _input jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  conn public.mcp_connections; ws uuid; uid uuid; role text; staff boolean; i jsonb := coalesce(_input, '{}'::jsonb);
  res jsonb; t public.tasks; c public.crm_contacts; ir public.crm_interactions; o public.crm_opportunities;
  ap public.approvals; ar public.automation_runs; ctx public.artist_context; lim int; q text; cat text; mods text[];
  clean jsonb; cur bigint; more boolean; id_ uuid; prior_claims text;
BEGIN
  IF jsonb_typeof(i) <> 'object' THEN RAISE EXCEPTION 'input must be an object'; END IF;
  SELECT * INTO conn FROM public.mcp_connections WHERE token_hash = _token_hash AND revoked_at IS NULL AND expires_at > now() FOR UPDATE;
  IF conn.id IS NULL THEN RETURN jsonb_build_object('error', 'invalid_connection'); END IF;
  ws := conn.artist_workspace_id; uid := conn.user_id;

  IF _operation = 'revoke_connection' THEN
    UPDATE public.mcp_connections SET revoked_at = now(), last_used_at = now() WHERE id = conn.id;
    RETURN jsonb_build_object('result', jsonb_build_object('revoked', true));
  END IF;

  SELECT m.role INTO role FROM public.artist_memberships m WHERE m.artist_workspace_id = ws AND m.user_id = uid;
  IF role IS NULL THEN
    UPDATE public.mcp_connections SET revoked_at = now(), metadata = metadata || '{"revoked_reason":"membership_removed"}' WHERE id = conn.id;
    RETURN jsonb_build_object('error', 'invalid_connection');
  END IF;
  staff := role IN ('employee','owner');
  UPDATE public.mcp_connections SET last_used_at = now() WHERE id = conn.id;
  PERFORM set_config('app.activity_source', 'mcp', true);

  IF _operation NOT IN ('introspect_connection','get_artist_context','get_operating_snapshot','get_recent_changes','list_tasks','search_contacts','get_contact','search_opportunities','get_discovery_status','get_ai_request','get_runtime_control') THEN
    PERFORM public._assert_runtime_write(ws);
  END IF;
  CASE _operation
  WHEN 'introspect_connection' THEN
    res := jsonb_build_object('user_id', uid, 'workspace_id', ws, 'role_at_issue', conn.role_at_issue, 'role', role,
      'created_at', conn.created_at, 'expires_at', conn.expires_at);

  WHEN 'begin_ai_request' THEN
    prior_claims := current_setting('request.jwt.claims',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    res := jsonb_build_object('request_id',public.begin_ai_gateway_request(ws,i->>'intent',i->>'user_message'));
    PERFORM set_config('request.jwt.claims',coalesce(prior_claims,''),true);
  WHEN 'get_runtime_control' THEN
    res := public.get_runtime_control(ws);
  WHEN 'get_ai_request' THEN
    SELECT jsonb_build_object('request_id',q.id,'status',q.status,'agent_run_id',q.agent_run_id,'response',q.response_payload,'error_code',q.error_code)
    INTO res FROM public.ai_gateway_requests q WHERE q.id=(i->>'request_id')::uuid AND q.artist_workspace_id=ws;
    IF res IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  WHEN 'get_artist_context' THEN
    res := public._gw_artist(ws);

  WHEN 'get_operating_snapshot' THEN
    res := jsonb_build_object('artist', public._gw_artist(ws),
      'activeProjects', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description, 'status', p.status, 'due_date', p.due_date) ORDER BY p.due_date NULLS LAST)
         FROM (SELECT * FROM public.projects WHERE artist_workspace_id = ws AND status = 'active' ORDER BY due_date NULLS LAST LIMIT 20) p), '[]'),
      'openTasks', coalesce((SELECT jsonb_agg(public._gw_task(x) ORDER BY x.due_date NULLS LAST, x.created_at)
         FROM (SELECT * FROM public.tasks WHERE artist_workspace_id = ws AND status <> 'DONE' ORDER BY due_date NULLS LAST, created_at LIMIT 50) x), '[]'),
      'workspaceVersion', (SELECT workspace_version FROM public.artist_workspaces WHERE id = ws));

  WHEN 'get_recent_changes' THEN
    lim := public._gw_lim(i->'limit', 50, 200);
    SELECT workspace_version INTO cur FROM public.artist_workspaces WHERE id = ws;
    IF i ? 'after_version' AND jsonb_typeof(i->'after_version') = 'number' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(e) - 'artist_workspace_id' - 'actor_user_id' ORDER BY e.workspace_version), '[]'), count(*) > lim INTO res, more FROM (
        SELECT * FROM public.activity_events WHERE artist_workspace_id = ws AND workspace_version > (i->>'after_version')::bigint AND (staff OR NOT internal)
        ORDER BY workspace_version LIMIT lim + 1) e;
    ELSE
      SELECT coalesce(jsonb_agg(to_jsonb(e) - 'artist_workspace_id' - 'actor_user_id' ORDER BY e.workspace_version DESC), '[]'), count(*) > lim INTO res, more FROM (
        SELECT * FROM public.activity_events WHERE artist_workspace_id = ws AND (staff OR NOT internal)
        ORDER BY workspace_version DESC LIMIT lim + 1) e;
    END IF;
    IF more THEN res := res - lim; END IF;
    res := jsonb_build_object('current_version', cur, 'events', res, 'has_more', more);

  WHEN 'list_tasks' THEN
    res := coalesce((SELECT jsonb_agg(public._gw_task(x) ORDER BY x.created_at DESC) FROM (
      SELECT * FROM public.tasks WHERE artist_workspace_id = ws AND (coalesce((i->>'include_done')::boolean, false) OR status <> 'DONE')
      ORDER BY created_at DESC LIMIT 200) x), '[]');
    res := jsonb_build_object('tasks', res);

  WHEN 'search_contacts' THEN
    lim := public._gw_lim(i->'limit', 20, 50); q := left(btrim(coalesce(i->>'query','')), 100);
    res := coalesce((SELECT jsonb_agg(public._gw_contact(x) ORDER BY x.display_name) FROM (
      SELECT * FROM public.crm_contacts WHERE artist_workspace_id = ws AND archived_at IS NULL
        AND (q = '' OR display_name ILIKE public._gw_like(q) OR email_primary ILIKE public._gw_like(q) OR city ILIKE public._gw_like(q) OR country ILIKE public._gw_like(q))
      ORDER BY display_name LIMIT lim) x), '[]');
    res := jsonb_build_object('contacts', res);

  WHEN 'get_contact' THEN
    id_ := public._gw_uuid(i->>'contact_id', 'contact_id');
    SELECT * INTO c FROM public.crm_contacts WHERE id = id_ AND artist_workspace_id = ws;
    IF c.id IS NULL THEN RAISE EXCEPTION 'contact not found'; END IF;
    res := public._gw_contact(c) || jsonb_build_object(
      'roles', coalesce((SELECT jsonb_agg(jsonb_build_object('role_type', r.role_type, 'priority', r.priority, 'relationship_strength', r.relationship_strength, 'status', r.status))
         FROM public.crm_contact_roles r WHERE r.contact_id = c.id AND r.artist_workspace_id = ws), '[]'),
      'organizations', coalesce((SELECT jsonb_agg(jsonb_build_object('id', og.id, 'name', og.name, 'organization_type', og.organization_type, 'role_title', co.role_title, 'is_primary', co.is_primary))
         FROM public.crm_contact_organizations co JOIN public.crm_organizations og ON og.id = co.organization_id AND og.artist_workspace_id = ws
         WHERE co.contact_id = c.id AND co.artist_workspace_id = ws), '[]'),
      'recentInteractions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'interaction_type', x.interaction_type, 'occurred_at', x.occurred_at, 'summary', x.summary, 'outcome', x.outcome, 'next_action', x.next_action, 'next_action_due_at', x.next_action_due_at) ORDER BY x.occurred_at DESC)
         FROM (SELECT * FROM public.crm_interactions WHERE contact_id = c.id AND artist_workspace_id = ws ORDER BY occurred_at DESC LIMIT 10) x), '[]'));

  WHEN 'search_opportunities' THEN
    lim := public._gw_lim(i->'limit', 20, 50); q := left(btrim(coalesce(i->>'query','')), 100);
    IF i ? 'status' AND i->>'status' NOT IN ('open','won','lost','on_hold') THEN RAISE EXCEPTION 'invalid status'; END IF;
    res := coalesce((SELECT jsonb_agg(to_jsonb(x) - 'artist_workspace_id' - 'created_by' - 'updated_by' ORDER BY x.updated_at DESC) FROM (
      SELECT * FROM public.crm_opportunities WHERE artist_workspace_id = ws AND archived_at IS NULL
        AND (NOT i ? 'status' OR status = i->>'status')
        AND (q = '' OR title ILIKE public._gw_like(q) OR market_city ILIKE public._gw_like(q) OR market_country ILIKE public._gw_like(q) OR notes ILIKE public._gw_like(q))
      ORDER BY updated_at DESC LIMIT lim) x), '[]');
    res := jsonb_build_object('opportunities', res);

  WHEN 'get_discovery_status' THEN
    SELECT delivery_category INTO cat FROM public.artist_workspaces WHERE id = ws;
    IF cat IS NULL THEN
      res := jsonb_build_object('category', NULL, 'message', 'Delivery category not chosen yet');
    ELSE
      mods := CASE cat WHEN 'DIY' THEN ARRAY['Standard Onboarding'] WHEN 'DONE_WITH_YOU' THEN ARRAY['Standard Onboarding','Personal Brand Lite']
                       ELSE ARRAY['Standard Onboarding','Deep Strategy','Personal Brand Full'] END;
      WITH qs AS (
        SELECT q.id, q.team_only, q.source_module, a.status,
          (a.status IN ('answered','verified','not_applicable') OR (cat <> 'DONE_FOR_YOU' AND a.status IN ('unknown','needs_verification'))) AS resolved
        FROM public.question_definitions q
        LEFT JOIN public.artist_question_answers a ON a.question_definition_id = q.id AND a.artist_workspace_id = ws
        WHERE q.active AND q.source_module = ANY (mods) AND (cat <> 'DIY' OR q.diy_core))
      SELECT jsonb_build_object('category', cat, 'modules', to_jsonb(mods),
        'artist', jsonb_build_object('total', count(*) FILTER (WHERE NOT team_only), 'resolved', count(*) FILTER (WHERE NOT team_only AND resolved)),
        'needsVerification', count(*) FILTER (WHERE NOT team_only AND status = 'needs_verification'),
        'unknown', count(*) FILTER (WHERE NOT team_only AND status = 'unknown'))
        || CASE WHEN staff THEN jsonb_build_object(
             'internal', jsonb_build_object('total', count(*) FILTER (WHERE team_only), 'resolved', count(*) FILTER (WHERE team_only AND resolved)),
             'overall', jsonb_build_object('total', count(*), 'resolved', count(*) FILTER (WHERE resolved))) ELSE '{}'::jsonb END
      INTO res FROM qs;
    END IF;

  WHEN 'create_task' THEN
    PERFORM public._mcp_check_keys(i, ARRAY['title','next_action','priority','due_date','source_agent','project_id','agent_run_id']);
    IF coalesce(btrim(i->>'title'),'') = '' OR length(i->>'title') > 300 THEN RAISE EXCEPTION 'title required (max 300)'; END IF;
    IF coalesce(i->>'priority','MEDIUM') NOT IN ('LOW','MEDIUM','HIGH') THEN RAISE EXCEPTION 'invalid priority'; END IF;
    id_ := public._gw_uuid(i->>'project_id', 'project_id');
    PERFORM public._mcp_check_links(ws, NULL, NULL, id_, NULL);
    INSERT INTO public.tasks(artist_workspace_id, user_id, title, next_action, priority, due_date, source_agent, project_id, agent_run_id, status)
    VALUES (ws, NULL, btrim(i->>'title'), left(i->>'next_action', 1000), coalesce(i->>'priority','MEDIUM'), (i->>'due_date')::date,
            left(coalesce(i->>'source_agent','chatgpt'), 50), id_, left(i->>'agent_run_id', 200), 'NEXT')
    RETURNING * INTO t;
    res := public._gw_task(t);

  WHEN 'update_task' THEN
    PERFORM public._mcp_check_keys(i, ARRAY['task_id','status','priority','due_date','next_action','agent_run_id']);
    id_ := public._gw_uuid(i->>'task_id', 'task_id');
    IF i ? 'status' AND i->>'status' NOT IN ('NEXT','IN_PROGRESS','WAITING','DONE') THEN RAISE EXCEPTION 'invalid status'; END IF;
    IF i ? 'priority' AND i->>'priority' NOT IN ('LOW','MEDIUM','HIGH') THEN RAISE EXCEPTION 'invalid priority'; END IF;
    UPDATE public.tasks SET status = coalesce(i->>'status', status), priority = coalesce(i->>'priority', priority),
      due_date = coalesce((i->>'due_date')::date, due_date), next_action = coalesce(left(i->>'next_action',1000), next_action),
      agent_run_id = coalesce(left(i->>'agent_run_id',200), agent_run_id)
    WHERE id = id_ AND artist_workspace_id = ws RETURNING * INTO t;
    IF t.id IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;
    res := public._gw_task(t);

  WHEN 'create_contact' THEN
    PERFORM public._mcp_check_keys(i, ARRAY['first_name','last_name','display_name','email_primary','email_secondary','phone_primary','phone_secondary','city','region','country','language','instagram_or_social','website','preferred_channel','notes','last_contact_at','next_follow_up_at','source_reference']);
    IF EXISTS (SELECT 1 FROM jsonb_each_text(i) e WHERE length(e.value) > CASE WHEN e.key = 'notes' THEN 5000 ELSE 500 END) THEN RAISE EXCEPTION 'field too long'; END IF;
    q := coalesce(nullif(btrim(i->>'display_name'),''), nullif(btrim(concat_ws(' ', i->>'first_name', i->>'last_name')),''));
    IF q IS NULL THEN RAISE EXCEPTION 'display_name or first/last name required'; END IF;
    INSERT INTO public.crm_contacts(artist_workspace_id, display_name, first_name, last_name, email_primary, email_secondary, phone_primary, phone_secondary, city, region, country, language, instagram_or_social, website, preferred_channel, notes, last_contact_at, next_follow_up_at, source_type, source_reference)
    VALUES (ws, q, i->>'first_name', i->>'last_name', i->>'email_primary', i->>'email_secondary', i->>'phone_primary', i->>'phone_secondary', i->>'city', i->>'region', i->>'country', i->>'language', i->>'instagram_or_social', i->>'website', i->>'preferred_channel', i->>'notes', (i->>'last_contact_at')::timestamptz, (i->>'next_follow_up_at')::timestamptz, 'mcp', i->>'source_reference')
    RETURNING * INTO c;
    res := public._gw_contact(c);

  WHEN 'update_contact' THEN
    id_ := public._gw_uuid(i->>'contact_id', 'contact_id');
    clean := i - 'contact_id';
    PERFORM public._mcp_check_keys(clean, ARRAY['first_name','last_name','display_name','email_primary','email_secondary','phone_primary','phone_secondary','city','region','country','language','instagram_or_social','website','preferred_channel','notes','last_contact_at','next_follow_up_at']);
    IF EXISTS (SELECT 1 FROM jsonb_each_text(clean) e WHERE length(e.value) > CASE WHEN e.key = 'notes' THEN 5000 ELSE 500 END) THEN RAISE EXCEPTION 'field too long'; END IF;
    IF clean ? 'display_name' AND coalesce(btrim(clean->>'display_name'),'') = '' THEN RAISE EXCEPTION 'display_name cannot be empty'; END IF;
    UPDATE public.crm_contacts SET
      display_name = CASE WHEN clean ? 'display_name' THEN btrim(clean->>'display_name') ELSE display_name END,
      first_name = CASE WHEN clean ? 'first_name' THEN clean->>'first_name' ELSE first_name END,
      last_name = CASE WHEN clean ? 'last_name' THEN clean->>'last_name' ELSE last_name END,
      email_primary = CASE WHEN clean ? 'email_primary' THEN clean->>'email_primary' ELSE email_primary END,
      email_secondary = CASE WHEN clean ? 'email_secondary' THEN clean->>'email_secondary' ELSE email_secondary END,
      phone_primary = CASE WHEN clean ? 'phone_primary' THEN clean->>'phone_primary' ELSE phone_primary END,
      phone_secondary = CASE WHEN clean ? 'phone_secondary' THEN clean->>'phone_secondary' ELSE phone_secondary END,
      city = CASE WHEN clean ? 'city' THEN clean->>'city' ELSE city END,
      region = CASE WHEN clean ? 'region' THEN clean->>'region' ELSE region END,
      country = CASE WHEN clean ? 'country' THEN clean->>'country' ELSE country END,
      language = CASE WHEN clean ? 'language' THEN clean->>'language' ELSE language END,
      instagram_or_social = CASE WHEN clean ? 'instagram_or_social' THEN clean->>'instagram_or_social' ELSE instagram_or_social END,
      website = CASE WHEN clean ? 'website' THEN clean->>'website' ELSE website END,
      preferred_channel = CASE WHEN clean ? 'preferred_channel' THEN clean->>'preferred_channel' ELSE preferred_channel END,
      notes = CASE WHEN clean ? 'notes' THEN clean->>'notes' ELSE notes END,
      last_contact_at = CASE WHEN clean ? 'last_contact_at' THEN (clean->>'last_contact_at')::timestamptz ELSE last_contact_at END,
      next_follow_up_at = CASE WHEN clean ? 'next_follow_up_at' THEN (clean->>'next_follow_up_at')::timestamptz ELSE next_follow_up_at END
    WHERE id = id_ AND artist_workspace_id = ws RETURNING * INTO c;
    IF c.id IS NULL THEN RAISE EXCEPTION 'contact not found'; END IF;
    res := public._gw_contact(c);

  WHEN 'log_interaction' THEN
    PERFORM public._mcp_check_keys(i, ARRAY['contact_id','organization_id','interaction_type','occurred_at','summary','outcome','next_action','next_action_due_at','project_id','task_id','source_reference']);
    IF coalesce(btrim(i->>'summary'),'') = '' OR length(i->>'summary') > 5000 THEN RAISE EXCEPTION 'summary required (max 5000)'; END IF;
    PERFORM public._mcp_check_links(ws, public._gw_uuid(i->>'contact_id','contact_id'), public._gw_uuid(i->>'organization_id','organization_id'), public._gw_uuid(i->>'project_id','project_id'), public._gw_uuid(i->>'task_id','task_id'));
    INSERT INTO public.crm_interactions(artist_workspace_id, contact_id, organization_id, interaction_type, occurred_at, summary, outcome, next_action, next_action_due_at, project_id, task_id, source_type, source_reference)
    VALUES (ws, (i->>'contact_id')::uuid, (i->>'organization_id')::uuid, coalesce(i->>'interaction_type','note'), coalesce((i->>'occurred_at')::timestamptz, now()), btrim(i->>'summary'), left(i->>'outcome',2000), left(i->>'next_action',1000), (i->>'next_action_due_at')::timestamptz, (i->>'project_id')::uuid, (i->>'task_id')::uuid, 'mcp', i->>'source_reference')
    RETURNING * INTO ir;
    res := to_jsonb(ir) - 'artist_workspace_id' - 'created_by' - 'updated_by';

  WHEN 'create_opportunity' THEN
    PERFORM public._mcp_check_keys(i, ARRAY['contact_id','organization_id','opportunity_type','title','stage','status','priority','market_city','market_country','value_amount','value_currency','date_window_start','date_window_end','next_action','next_action_due_at','project_id','notes','source_reference']);
    IF coalesce(btrim(i->>'title'),'') = '' OR length(i->>'title') > 300 THEN RAISE EXCEPTION 'title required (max 300)'; END IF;
    IF length(coalesce(i->>'notes','')) > 5000 THEN RAISE EXCEPTION 'notes too long'; END IF;
    PERFORM public._mcp_check_links(ws, public._gw_uuid(i->>'contact_id','contact_id'), public._gw_uuid(i->>'organization_id','organization_id'), public._gw_uuid(i->>'project_id','project_id'), NULL);
    INSERT INTO public.crm_opportunities(artist_workspace_id, contact_id, organization_id, opportunity_type, title, stage, status, priority, market_city, market_country, value_amount, value_currency, date_window_start, date_window_end, next_action, next_action_due_at, project_id, notes, source_type, source_reference)
    VALUES (ws, (i->>'contact_id')::uuid, (i->>'organization_id')::uuid, coalesce(i->>'opportunity_type','other'), btrim(i->>'title'), left(coalesce(i->>'stage','lead'),50), coalesce(i->>'status','open'), i->>'priority', left(i->>'market_city',200), left(i->>'market_country',200), (i->>'value_amount')::numeric, left(i->>'value_currency',10), (i->>'date_window_start')::date, (i->>'date_window_end')::date, left(i->>'next_action',1000), (i->>'next_action_due_at')::timestamptz, (i->>'project_id')::uuid, i->>'notes', 'mcp', i->>'source_reference')
    RETURNING * INTO o;
    res := to_jsonb(o) - 'artist_workspace_id' - 'created_by' - 'updated_by';

  WHEN 'update_weekly_priorities' THEN
    PERFORM public._mcp_check_keys(i, ARRAY['priorities']);
    IF jsonb_typeof(i->'priorities') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'priorities must be an array of strings'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(i->'priorities') e WHERE jsonb_typeof(e) <> 'string' OR length(e #>> '{}') > 200) THEN RAISE EXCEPTION 'each priority must be a string (max 200)'; END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(btrim(e #>> '{}')) ORDER BY ord), '[]') INTO clean
      FROM jsonb_array_elements(i->'priorities') WITH ORDINALITY x(e, ord) WHERE btrim(e #>> '{}') <> '';
    IF jsonb_array_length(clean) > 3 THEN RAISE EXCEPTION 'max 3 weekly priorities'; END IF;
    UPDATE public.artist_context SET weekly_priorities = clean WHERE artist_workspace_id = ws RETURNING * INTO ctx;
    IF ctx.id IS NULL THEN RAISE EXCEPTION 'artist context not found'; END IF;
    res := public._gw_artist(ws);

  WHEN 'request_approval' THEN
    PERFORM public._mcp_check_keys(i, ARRAY['title','description','requested_by','action_fingerprint','related_object']);
    IF coalesce(btrim(i->>'title'),'') = '' OR length(i->>'title') > 300 THEN RAISE EXCEPTION 'title required (max 300)'; END IF;
    INSERT INTO public.approvals(artist_workspace_id, title, description, requested_by, status, action_fingerprint, related_object)
    VALUES (ws, btrim(i->>'title'), left(i->>'description', 4000), left(coalesce(i->>'requested_by','chatgpt'), 100), 'pending', left(i->>'action_fingerprint', 200), left(i->>'related_object', 200))
    RETURNING * INTO ap;
    res := jsonb_build_object('id', ap.id, 'title', ap.title, 'description', ap.description, 'status', ap.status, 'requested_by', ap.requested_by,
      'action_fingerprint', ap.action_fingerprint, 'related_object', ap.related_object, 'created_at', ap.created_at);

  WHEN 'log_agent_run' THEN
    PERFORM public._mcp_check_keys(i, ARRAY['automation_key','status','input','output','error']);
    IF coalesce(btrim(i->>'automation_key'),'') = '' OR length(i->>'automation_key') > 100 THEN RAISE EXCEPTION 'automation_key required (max 100)'; END IF;
    IF coalesce(i->>'status','') NOT IN ('queued','running','succeeded','failed','cancelled') THEN RAISE EXCEPTION 'invalid status'; END IF;
    IF pg_column_size(coalesce(i->'input','{}'::jsonb)) + pg_column_size(coalesce(i->'output','{}'::jsonb)) > 65536 THEN RAISE EXCEPTION 'input/output too large'; END IF;
    INSERT INTO public.automation_runs(artist_workspace_id, automation_key, status, input, output, error, started_at, finished_at)
    VALUES (ws, btrim(i->>'automation_key'), i->>'status', coalesce(i->'input','{}'::jsonb), coalesce(i->'output','{}'::jsonb), left(i->>'error', 2000),
            CASE WHEN i->>'status' <> 'queued' THEN now() END, CASE WHEN i->>'status' IN ('succeeded','failed','cancelled') THEN now() END)
    RETURNING * INTO ar;
    res := jsonb_build_object('id', ar.id, 'automation_key', ar.automation_key, 'status', ar.status, 'created_at', ar.created_at);

  ELSE
    RAISE EXCEPTION 'unknown operation';
  END CASE;

  RETURN jsonb_build_object('result', res);
END $function$
;
CREATE TABLE IF NOT EXISTS public.mcp_oauth_code_uses (
 code_hash text PRIMARY KEY, expires_at timestamptz NOT NULL
);
ALTER TABLE public.mcp_oauth_code_uses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_oauth_code_uses FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.consume_mcp_oauth_code(_code_hash text,_expires_at timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
 IF _code_hash !~ '^[a-f0-9]{64}$' OR _expires_at <= now() OR _expires_at > now()+interval '10 minutes' THEN RETURN false; END IF;
 DELETE FROM public.mcp_oauth_code_uses WHERE expires_at < now();
 INSERT INTO public.mcp_oauth_code_uses VALUES(_code_hash,_expires_at) ON CONFLICT DO NOTHING;
 RETURN FOUND;
END $fn$;
REVOKE ALL ON FUNCTION public.consume_mcp_oauth_code(text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_mcp_oauth_code(text,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.validate_ai_ceo_response(_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare a jsonb;
declare n int := 0;
declare bad text[] := '{}';
declare due text;
begin
  if _payload is null or jsonb_typeof(_payload) IS DISTINCT FROM 'object' then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('payload_not_object'));
  end if;

  if jsonb_typeof(_payload->'current_state') IS DISTINCT FROM 'object' then bad:=array_append(bad,'current_state'); end if;
  if jsonb_typeof(_payload->'diagnosis') IS DISTINCT FROM 'object' then bad:=array_append(bad,'diagnosis'); end if;
  if jsonb_typeof(_payload->'actions') IS DISTINCT FROM 'array' then bad:=array_append(bad,'actions'); end if;
  if jsonb_typeof(_payload->'missing_data') IS DISTINCT FROM 'array' then bad:=array_append(bad,'missing_data'); end if;
  if jsonb_typeof(_payload->'notes') IS DISTINCT FROM 'array' then bad:=array_append(bad,'notes'); end if;

  if cardinality(bad)>0 then
    return jsonb_build_object('valid',false,'errors',to_jsonb(bad));
  end if;

  if jsonb_typeof(_payload#>'{diagnosis,confidence}') is distinct from 'number' then return jsonb_build_object('valid',false); end if;
  if (_payload#>>'{diagnosis,confidence}')::numeric not between 0 and 1 then return jsonb_build_object('valid',false); end if;
  n := jsonb_array_length(_payload->'actions');
  if n > 3 then return jsonb_build_object('valid',false,'errors',jsonb_build_array('too_many_actions')); end if;

  for a in select * from jsonb_array_elements(_payload->'actions') loop
    if coalesce(a->>'title','')='' then return jsonb_build_object('valid',false,'errors',jsonb_build_array('action_missing_title')); end if;
    if coalesce(a->>'next_action','')='' then return jsonb_build_object('valid',false,'errors',jsonb_build_array('action_missing_next_action')); end if;
    if coalesce(a->>'owner_type','') not in ('ARTIST','HUMAN','AI_AGENT','AGENCY') then
      return jsonb_build_object('valid',false,'errors',jsonb_build_array('invalid_owner_type'));
    end if;
    if coalesce(a->>'priority','') not in ('HIGH','MEDIUM','LOW') then
      return jsonb_build_object('valid',false,'errors',jsonb_build_array('invalid_priority'));
    end if;
    if coalesce(a->>'domain','') not in ('strategy','music','release','content','audience','growth','live','revenue','finance','industry','operations') then
      return jsonb_build_object('valid',false,'errors',jsonb_build_array('invalid_domain'));
    end if;
    if jsonb_typeof(a->'consequential') is distinct from 'boolean' then return jsonb_build_object('valid',false); end if;
    if (a->>'consequential')::boolean and coalesce(a->>'consequence_type','') not in ('EMAIL','SOCIAL_PUBLISH','SPEND','BOOKING_ACCEPTANCE','CONTRACT_RIGHTS','RELEASE_DATE_CHANGE','PUBLIC_STATEMENT','OTHER') then return jsonb_build_object('valid',false); end if;
    due := nullif(a->>'due_date','');
    if due is not null then
      begin perform due::date; exception when others then return jsonb_build_object('valid',false); end;
    end if;
    if due is not null and due !~ '^\d{4}-\d{2}-\d{2}$' then
      return jsonb_build_object('valid',false,'errors',jsonb_build_array('invalid_due_date'));
    end if;
  end loop;

  return jsonb_build_object('valid',true,'errors','[]'::jsonb);
end $function$
;
COMMIT;
