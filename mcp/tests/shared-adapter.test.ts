import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SharedNotionArtistAdapter, allowedArtistsForOwner } from '../src/adapters/shared-notion.js';
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
const artist={id:a,parent:{database_id:'artists'},properties:{}};
const task=(id=a,db='tasks')=>({id:'task',parent:{database_id:db},properties:{'Artist ID':{type:'rich_text',rich_text:[{plain_text:id}]}}});
const policy=(mode='SUPERVISED')=>({results:[{properties:{Mode:{type:'select',select:{name:mode}},'External Actions':{type:'select',select:{name:'APPROVAL ONLY'}}}}]});
const adapter=()=>new SharedNotionArtistAdapter({token:'test-only',artistsDb:'artists',tasksDb:'tasks',controlDb:'control',allowedArtistIds:[a]});
const input={artistId:a,task:'x',nextAction:'x',sourceAgent:'test'};
async function mocked(responses:any[], run:(calls:any[])=>Promise<void>) {
 const original=globalThis.fetch, calls:any[]=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),method:init?.method,body:init?.body?JSON.parse(String(init.body)):null});assert.ok(responses.length,'Unexpected API call');return new Response(JSON.stringify(responses.shift()),{status:200});};
 try {await run(calls);} finally {globalThis.fetch=original;}
}
test('invalid ACL root fails closed',()=>{for(const raw of ['null','[]','true']) assert.throws(()=>allowedArtistsForOwner('u','w',raw),/Invalid/);});
test('unauthorized artist makes no API calls',async()=>mocked([],async c=>{await assert.rejects(adapter().getArtistContext(b),/denied/);assert.equal(c.length,0);}));
test('agent cannot create approval decisions',async()=>mocked([],async c=>{for(const approvalState of ['Approved','Rejected'] as const)await assert.rejects(adapter().createTask({...input,approvalState}),/Approval decisions/);assert.equal(c.length,0);}));
test('foreign artist or database cannot be edited',async()=>{for(const p of [task(b),task(a,'other')])await mocked([artist,p],async c=>{await assert.rejects(adapter().updateTask({artistId:a,taskId:'task',status:'Done'}),/denied/);assert.ok(c.every(x=>x.method==='GET'));});});
test('Notion kill switch blocks writes',async()=>mocked([artist,policy('PAUSED')],async c=>{await assert.rejects(adapter().createTask(input),/PAUSED/);assert.equal(c.length,2);}));
test('missing ambiguous and invalid policy blocks writes',async()=>{for(const p of [{results:[]},{results:[{},{}]},policy('UNKNOWN')])await mocked([artist,p],async()=>{await assert.rejects(adapter().createTask(input));});});
test('query filters artist and rejects leaked rows',async()=>mocked([artist,{results:[task(b)]}],async c=>{await assert.rejects(adapter().getOperatingSnapshot(a),/out-of-scope/);assert.equal(c[1].body.filter.rich_text.equals,a);}));
test('task creation stamps artist and pending approval',async()=>mocked([artist,policy(),task()],async c=>{assert.equal((await adapter().createTask({...input,approvalState:'Pending'})).id,'task');assert.equal(c[2].body.properties['Artist ID'].rich_text[0].text.content,a);assert.equal(c[2].body.properties['Approval State'].select.name,'Pending');}));
test('created task ownership is verified',async()=>mocked([artist,policy(),task(a,'other')],async()=>{await assert.rejects(adapter().createTask(input),/ownership/);}));
