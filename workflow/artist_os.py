#!/usr/bin/env python3
"""Local planning prototype. No network, AI, execution, synchronization or approval authority."""
import argparse
import datetime as dt
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
DOMAINS = ('career', 'music_releases', 'growth', 'content', 'live', 'relationships', 'rights_revenue')
TEMPLATE = json.loads((ROOT / 'templates/release-tasks.json').read_text())
CATALOG = json.loads((ROOT / 'templates/input-catalog.json').read_text())
INPUT_IDS = {r['request_id'] for r in CATALOG['requests']}
STATES = {'todo', 'in_progress', 'done', 'not_applicable'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def iso_date(value):
    require(isinstance(value, str), 'Date must be YYYY-MM-DD')
    return dt.date.fromisoformat(value)


def initialize(artist_id, name, cycle_id=None, release_date=None):
    for value in (artist_id, cycle_id):
        if value is not None:
            require(re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}', value), 'IDs: 1–80 letters, digits, _ or -')
    require(bool(name.strip()), 'Name required')
    if release_date:
        iso_date(release_date)
    require(cycle_id or not release_date, '--release-date requires --cycle-id')
    data = {'schemaVersion':1, 'templateVersion':TEMPLATE['version'], 'revision':1,
            'artist':{'id':artist_id, 'name':name, 'careerStage':None, 'onboardingStatus':None, 'owner':None},
            'sources':[], 'monthlyInputs':[], 'cycles':[], 'carryForward':[], 'audit':[]}
    if cycle_id:
        tasks = []
        for t in TEMPLATE['tasks']:
            tasks.append({'id':t['id'], 'planVersion':1, 'state':'todo', 'owner':None, 'evidence':None,
                          'notApplicableReason':None, 'dueDate':None})
        data['cycles'].append({'id':cycle_id, 'releaseDate':release_date, 'planVersion':1,
            'closed':False, 'sourceVersions':{}, 'inputExceptions':[],
            'reviews':[{'domain':d, 'state':'pending', 'planVersion':1,
                        'evidence':None, 'reviewer':None, 'decision':None} for d in DOMAINS],
            'gates':[{'id':g, 'state':'pending', 'planVersion':1, 'approvedBy':None,
                      'approvedAt':None, 'evidence':None} for g in ('G0','G1','G2','G3')], 'tasks':tasks})
    return data


def validate(data):
    require(isinstance(data, dict), 'Root must be an object')
    require(data.get('schemaVersion') == 1, 'Unsupported schemaVersion')
    require(data.get('templateVersion') == TEMPLATE['version'], 'Template migration needed')
    require(type(data.get('revision')) is int and data['revision'] > 0, 'Positive revision required')
    require(isinstance(data.get('artist'), dict), 'artist missing')
    require(bool(data['artist'].get('id')) and bool(data['artist'].get('name')), 'Artist id/name missing')
    for key in ('sources', 'monthlyInputs', 'cycles', 'carryForward', 'audit'):
        require(isinstance(data.get(key), list), f'{key} must be an array')
    sources = {}
    for s in data['sources']:
        require(s.get('id') not in sources and bool(s.get('id')), 'Duplicate/missing source id')
        require(s.get('inputId') in INPUT_IDS, 'Unknown input request')
        require(type(s.get('version')) is int and s['version'] > 0, 'Positive source version required')
        require(s.get('state') in {'unverified','valid','stale','rejected'}, 'Invalid source state')
        require(bool(s.get('reference')), 'Source reference required (never credentials)')
        if s['state']=='valid':
            require(bool(s.get('verifiedBy')) and bool(s.get('verifiedAt')), 'Verified source needs reviewer/time')
            dt.datetime.fromisoformat(s['verifiedAt'])
        if s.get('expiresOn'): iso_date(s['expiresOn'])
        sources[s['id']] = s
    seen = set()
    for m in data['monthlyInputs']:
        require(re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',m.get('period','')), 'Monthly period must be YYYY-MM')
        require(m['period'] not in seen, 'Duplicate monthly period')
        seen.add(m['period'])
        require(m.get('state') in {'requested','partial','verified'}, 'Invalid monthly state')
        require(all(s in sources for s in m.get('sourceIds',[])), 'Unknown monthly source')
        if m['state']=='verified':
            require(bool(m.get('sourceIds')) and bool(m.get('verifiedBy')), 'Verified month needs evidence/reviewer')
    seen = set()
    template_ids = {t['id'] for t in TEMPLATE['tasks']}
    for c in data['cycles']:
        require(bool(c.get('id')) and c['id'] not in seen, 'Duplicate/missing cycle id')
        seen.add(c['id'])
        require(type(c.get('planVersion')) is int and c['planVersion'] > 0, 'Positive planVersion required')
        require(type(c.get('closed')) is bool, 'closed must be boolean')
        if c.get('releaseDate'): iso_date(c['releaseDate'])
        require(isinstance(c.get('sourceVersions'),dict), 'sourceVersions must be an object')
        for sid, version in c['sourceVersions'].items():
            require(sid in sources and type(version) is int and version > 0, 'Unknown/invalid source reference')
        require(isinstance(c.get('inputExceptions'),list), 'inputExceptions must be an array')
        exception_ids=set()
        for e in c['inputExceptions']:
            require(e.get('inputId') in {'REQ-12','REQ-13','REQ-14'}, 'Only campaign/show inputs support an applicability exception')
            require(e['inputId'] not in exception_ids, 'Duplicate input exception')
            exception_ids.add(e['inputId'])
            require(bool(e.get('reason')) and bool(e.get('reviewedBy')), 'Input exception needs reason/reviewer')
            require(type(e.get('planVersion')) is int and e['planVersion'] > 0, 'Invalid exception version')
        reviews = c.get('reviews',[])
        require(len(reviews)==7 and {r.get('domain') for r in reviews} == set(DOMAINS), 'Exactly seven distinct domain reviews required')
        for r in reviews:
            require(r.get('state') in {'pending','complete'}, 'Invalid review state')
            require(type(r.get('planVersion')) is int and r['planVersion'] > 0, 'Invalid review version')
            if r['state']=='complete':
                require(all(r.get(k) for k in ('evidence','reviewer','decision')), 'Complete review needs evidence/reviewer/decision')
        gates=c.get('gates',[])
        require(len(gates)==4 and {g.get('id') for g in gates}=={'G0','G1','G2','G3'},'Four gates required')
        for g in gates:
            require(g.get('state') in {'pending','approved','rejected'},'Invalid gate state')
            require(type(g.get('planVersion')) is int and g['planVersion'] > 0,'Invalid gate version')
            if g['state']=='approved':
                require(all(g.get(k) for k in ('approvedBy','approvedAt','evidence')), 'Approval needs human, timestamp and evidence')
                dt.datetime.fromisoformat(g['approvedAt'])
        tasks=c.get('tasks',[])
        require(len(tasks)==len(template_ids) and {t.get('id') for t in tasks}==template_ids,'Exactly one instance of each task per cycle required')
        for t in tasks:
            require(t.get('state') in STATES,'Invalid task state')
            require(type(t.get('planVersion')) is int and t['planVersion'] > 0, 'Invalid task version')
            if t.get('dueDate'): iso_date(t['dueDate'])
            if t['state']=='done': require(bool(t.get('evidence')),'Done task needs evidence')
            if t['state']=='not_applicable': require(bool(t.get('notApplicableReason')),'N/A task needs reason')
        if c['closed']:
            require(gate_ready(c,'G3'), 'Closed cycle needs current approved G3')
            require(all(sources[sid]['version']==version and sources[sid]['state']=='valid' for sid,version in c['sourceVersions'].items()), 'Closed cycle cannot use superseded/rejected sources')
            for t in tasks:
                if t['state'] not in {'done','not_applicable'} or t['planVersion'] != c['planVersion']:
                    template=next(x for x in TEMPLATE['tasks'] if x['id']==t['id'])
                    require(template['canCarryForward'] and any(x.get('cycleId')==c['id'] and x.get('taskId')==t['id'] for x in data['carryForward']), 'Unfinished task must remain in an explicit carry-forward record')
    for item in data['carryForward']:
        require(item.get('cycleId') in seen and item.get('taskId') in template_ids,'Invalid carry-forward reference')
        require(bool(item.get('owner')) and bool(item.get('nextReviewDate')), 'Carry-forward needs owner and nextReviewDate')
        iso_date(item['nextReviewDate'])
    return data


def gate_ready(cycle, name):
    gates={g['id']:g for g in cycle['gates']}
    order=('G0','G1','G2','G3')
    for gate_id in order[:order.index(name)+1]:
        g=gates[gate_id]
        if g['state']!='approved' or g['planVersion']!=cycle['planVersion']:
            return False
    if name!='G0' and any(r['state']!='complete' or r['planVersion']!=cycle['planVersion'] for r in cycle['reviews']):
        return False
    return True


def status(data, today):
    validate(data)
    output={'artistId':data['artist']['id'], 'artist':data['artist']['name'], 'asOf':today.isoformat(),
            'revision':data['revision'], 'mode':'LOCAL_PLANNING_ONLY', 'artistMissing':[],
            'monthlyInputMissing':None, 'cycles':[], 'carryForward':data['carryForward']}
    for key in ('owner','careerStage','onboardingStatus'):
        if data['artist'].get(key) is None: output['artistMissing'].append(key)
    period=(today.replace(day=1)-dt.timedelta(days=1)).strftime('%Y-%m')
    if not any(m['period']==period and m['state']=='verified' for m in data['monthlyInputs']):
        output['monthlyInputMissing']=period
    sources={s['id']:s for s in data['sources']}
    for c in data['cycles']:
        missing=[]; valid_inputs=set(); stale=[]
        for sid, version in c['sourceVersions'].items():
            s=sources[sid]
            if s['version']==version and s['state']=='valid' and (not s.get('expiresOn') or iso_date(s['expiresOn'])>=today):
                valid_inputs.add(s['inputId'])
            else: stale.append(sid)
        exceptions={e['inputId'] for e in c['inputExceptions'] if e['planVersion']==c['planVersion']}
        tasks={t['id']:t for t in c['tasks']}
        rows=[]
        for template in TEMPLATE['tasks']:
            t=tasks[template['id']]; reasons=[]
            current=t['planVersion']==c['planVersion'] and not stale
            if t['state'] not in {'done','not_applicable'} or not current:
                if not current: reasons.append('task_version_recheck')
                for dependency in template['dependencies']:
                    if tasks[dependency]['state']!='done' or tasks[dependency]['planVersion']!=c['planVersion']: reasons.append('dependency:'+dependency)
                for input_id in template['inputIds']:
                    if input_id not in valid_inputs and input_id not in exceptions: reasons.append('input:'+input_id); missing.append(input_id)
                if not t['owner']: reasons.append('owner_missing')
                n=int(t['id'][-2:])
                if n>=12 and not gate_ready(c,'G1'): reasons.append('gate:G1')
                if n>=19 and not gate_ready(c,'G2'): reasons.append('gate:G2')
                if stale: reasons.append('source_versions_changed')
            due=t.get('dueDate')
            suggested=None
            if c.get('releaseDate') and template['offsetDays'] is not None:
                suggested=(iso_date(c['releaseDate'])+dt.timedelta(days=template['offsetDays'])).isoformat()
            rows.append({'id':t['id'],'title':template['title'],'recordedState':t['state'],
                         'readiness':'complete' if t['state']=='done' and current else 'not_applicable' if t['state']=='not_applicable' and current else 'blocked' if reasons else 'ready_for_internal_work',
                         'blockers':reasons,'dueDate':due,'suggestedDate':suggested,
                         'overdue':bool(due and iso_date(due)<today and t['state'] not in {'done','not_applicable'})})
        pending=[g['id'] for g in c['gates'] if not gate_ready(c,g['id'])]
        output['cycles'].append({'id':c['id'],'state':'CLOSED' if c['closed'] else 'WAITING_FOR_DATA' if missing or stale else 'WAITING_FOR_APPROVAL' if pending else 'INTERNAL_WORK_READY',
            'missingInputs':sorted(set(missing)), 'staleSources':stale,
            'reviewsMissing':[r['domain'] for r in c['reviews'] if r['state']!='complete' or r['planVersion']!=c['planVersion']],
            'pendingGates':pending,'nextTasks':[r for r in rows if r['readiness']=='ready_for_internal_work'][:3], 'tasks':rows})
    return output


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    add=sub.add_parser('add-artist')
    add.add_argument('--id',required=True); add.add_argument('--name',required=True)
    add.add_argument('--cycle-id'); add.add_argument('--release-date')
    add.add_argument('--workspace',type=pathlib.Path,default=ROOT/'private')
    for cmd in ('validate','status'):
        p=sub.add_parser(cmd); p.add_argument('file',type=pathlib.Path)
        if cmd=='status': p.add_argument('--as-of',default=dt.date.today().isoformat())
    args=parser.parse_args()
    try:
        if args.command=='add-artist':
            data=initialize(args.id,args.name,args.cycle_id,args.release_date); validate(data)
            args.workspace.mkdir(parents=True,exist_ok=True)
            target=args.workspace/(args.id+'.json')
            with target.open('x',encoding='utf-8') as out: json.dump(data,out,ensure_ascii=False,indent=2); out.write('\n')
            print(str(target))
            print(json.dumps(status(data,dt.date.today()),ensure_ascii=False,indent=2))
        else:
            data=json.loads(args.file.read_text(encoding='utf-8')); validate(data)
            print('VALID' if args.command=='validate' else json.dumps(status(data,iso_date(args.as_of)),ensure_ascii=False,indent=2))
    except (ValueError,TypeError,KeyError,OSError) as error:
        parser.exit(2,f'ERROR: {error}\n')


if __name__=='__main__': main()

