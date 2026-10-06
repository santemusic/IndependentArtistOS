-- Execute inside a transaction and ROLLBACK; creates no lasting artist data.
DO $test$
DECLARE
 w uuid:=gen_random_uuid(); w2 uuid:=gen_random_uuid(); u uuid;
 t uuid; t2 uuid; a uuid; a2 uuid; r uuid; q uuid; q2 uuid; b1 uuid; b2 uuid;
 test_token_hash text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
 result jsonb; response jsonb:= '{"current_state":{"summary":"test","facts_used":[]},"diagnosis":{"primary_bottleneck":"test","evidence":[],"confidence":0.5},"actions":[{"title":"Test draft","why":"Test","owner_type":"ARTIST","owner_name":null,"priority":"MEDIUM","due_date":null,"next_action":"Review draft","domain":"operations","consequential":true,"consequence_type":"EMAIL"}],"missing_data":[],"notes":[]}'::jsonb;
BEGIN
 SELECT user_id INTO u FROM public.artist_memberships LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Test needs an existing member'; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 INSERT INTO public.artist_workspaces(id,name,created_by) VALUES(w,'Rollback execution test',u),(w2,'Rollback isolation test',u);
 INSERT INTO public.artist_memberships(artist_workspace_id,user_id,role) VALUES(w,u,'artist'),(w2,u,'artist');
 t:=public.create_agent_task(w,'Test',_fingerprint=>'test-task');
 t2:=public.create_agent_task(w,'Test',_fingerprint=>'test-task');
 IF t<>t2 THEN RAISE EXCEPTION 'Task deduplication failed'; END IF;
 a:=public.request_approval(w,'Test','Test','EMAIL','{}','ceo-manager',_fingerprint=>'test-approval');
 a2:=public.request_approval(w,'Test','Test','EMAIL','{}','ceo-manager',_fingerprint=>'test-approval');
 IF a<>a2 THEN RAISE EXCEPTION 'Approval deduplication failed'; END IF;
 UPDATE public.automation_control SET kill_switch=true WHERE artist_workspace_id=w;
 BEGIN
  PERFORM public.create_agent_task(w,'Must not happen');
  RAISE EXCEPTION 'Kill switch did not block writes';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Runtime blocked' THEN RAISE; END IF; END;
 UPDATE public.automation_control SET kill_switch=false,global_mode='SUPERVISED' WHERE artist_workspace_id=w;
 r:=public.log_agent_run(w,'ceo-manager',_status=>'QUEUED',_fingerprint=>'test-run');
 INSERT INTO public.ai_gateway_requests(artist_workspace_id,agent_run_id,contract_key,intent,idempotency_key)
 VALUES(w,r,'ceo-manager-v1','weekly','test-request') RETURNING id INTO q;
 result:=public.complete_ai_gateway_request(q,response);
 IF result->>'status'<>'QUEUED' THEN RAISE EXCEPTION 'Unclaimed completion accepted'; END IF;
 result:=public.claim_ai_gateway_request(q);
 IF NOT (result->>'claimed')::boolean THEN RAISE EXCEPTION 'Claim failed'; END IF;
 IF (public.claim_ai_gateway_request(q)->>'claimed')::boolean THEN RAISE EXCEPTION 'Double claim accepted'; END IF;
 UPDATE public.automation_control SET kill_switch=true WHERE artist_workspace_id=w;
 result:=public.complete_ai_gateway_request(q,response);
 IF result->>'status'<>'BLOCKED' THEN RAISE EXCEPTION 'Completion ignored pause'; END IF;
 IF (SELECT count(*) FROM public.tasks WHERE artist_workspace_id=w)<>1 THEN RAISE EXCEPTION 'Paused completion wrote tasks'; END IF;
 UPDATE public.automation_control SET kill_switch=false WHERE artist_workspace_id=w;
 r:=public.log_agent_run(w,'ceo-manager',_status=>'QUEUED',_fingerprint=>'test-run-2');
 INSERT INTO public.ai_gateway_requests(artist_workspace_id,agent_run_id,contract_key,intent,idempotency_key)
 VALUES(w,r,'ceo-manager-v1','weekly','test-request-2') RETURNING id INTO q2;
 PERFORM public.claim_ai_gateway_request(q2);
 result:=public.complete_ai_gateway_request(q2,response);
 IF result->>'status'<>'SUCCEEDED' THEN RAISE EXCEPTION 'Completion failed: %',result; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE artist_workspace_id=w AND title='Test draft' AND approval_state='PENDING' AND approval_id IS NOT NULL) THEN RAISE EXCEPTION 'Consequential action not gated'; END IF;
 PERFORM public.complete_ai_gateway_request(q2,response);
 IF (SELECT count(*) FROM public.tasks WHERE artist_workspace_id=w)<>2 THEN RAISE EXCEPTION 'Repeated completion duplicated task'; END IF;
 PERFORM public.fail_ai_gateway_request(q2,'TEST','test');
 IF (SELECT status FROM public.agent_runs WHERE id=r)<>'SUCCEEDED' THEN RAISE EXCEPTION 'Late failure corrupted success'; END IF;
 BEGIN
  PERFORM public.request_approval(w2,'Test','Test','EMAIL','{}','ceo-manager',r);
  RAISE EXCEPTION 'Cross-workspace approval accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Run belongs to another workspace' THEN RAISE; END IF; END;
 INSERT INTO public.mcp_connections(token_hash,user_id,artist_workspace_id,role_at_issue,expires_at) VALUES(test_token_hash,u,w2,'artist',now()+interval '1 hour');
 BEGIN
  PERFORM public.mcp_gateway_call(test_token_hash,'get_ai_request',jsonb_build_object('request_id',q2));
  RAISE EXCEPTION 'Cross-workspace request accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Request not found' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u)::text,true);
 b1:=public.begin_ai_gateway_request(w,'weekly','test message one');
 IF public.begin_ai_gateway_request(w,'weekly','test message one')<>b1 THEN RAISE EXCEPTION 'Request deduplication failed'; END IF;
 b2:=public.begin_ai_gateway_request(w,'weekly','test message two');
 IF b1=b2 THEN RAISE EXCEPTION 'Different user messages collapsed'; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 UPDATE public.mcp_connections SET artist_workspace_id=w WHERE token_hash=test_token_hash;
 result:=public.mcp_gateway_call(test_token_hash,'begin_ai_request','{"intent":"weekly","user_message":"test message one"}');
 IF result#>>'{result,request_id}' IS DISTINCT FROM b1::text THEN RAISE EXCEPTION 'Gateway queue failed: %',result; END IF;
 IF auth.role()<>'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Gateway did not restore claims'; END IF;
 INSERT INTO public.ai_gateway_requests(artist_workspace_id,contract_key,intent,idempotency_key,status)
 SELECT w,'ceo-manager-v1','weekly','quota-test-'||n,'SUCCEEDED' FROM generate_series(1,6) n;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u)::text,true);
 BEGIN
  PERFORM public.begin_ai_gateway_request(w,'weekly','eleventh test message');
  RAISE EXCEPTION 'Hourly request limit ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'AI request limit reached; retry after the hourly window' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 IF NOT public.consume_mcp_oauth_code(test_token_hash,now()+interval '5 minutes') THEN RAISE EXCEPTION 'First OAuth use denied'; END IF;
 IF public.consume_mcp_oauth_code(test_token_hash,now()+interval '5 minutes') THEN RAISE EXCEPTION 'OAuth replay accepted'; END IF;
 IF (public.validate_ai_ceo_response('{}')->>'valid')::boolean THEN RAISE EXCEPTION 'Missing fields accepted'; END IF;
 IF (public.validate_ai_ceo_response(jsonb_set(response,'{actions,0,due_date}','"2026-02-31"'))->>'valid')::boolean THEN RAISE EXCEPTION 'Invalid date accepted'; END IF;
END $test$;
SELECT 'execution regression tests passed; fixtures rolled back' AS result;
