"""Synthetic dry run of the documented manual tables; does not test Google Sheets
permissions, UI, concurrency, validation rules, or automatically enforce gates.
All fixture people, IDs and evidence are fictional. No network or Drive writes.
"""
import copy
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
VERSION = '2026-10-10-drive-first-v1'
DOMAINS = ['Career', 'Music & Releases', 'Growth', 'Content', 'Live', 'Relationships', 'Rights & Revenue']
CONTROL = 'Record ID|Artist ID|Cycle ID|Record Type|Domain / Gate|Plan Version|Status|Reviewer / Decider|Decision|Decision Date|Evidence URL|Source IDs / Versions|Task IDs|Template Version|Coordinator|Confirmed Release Date|Open Obligations|Next Review Date|Updated By|Updated At'.split('|')
TASKS = 'Task ID|Artist ID|Workstream|Task|Owner|Due Date|Status|Priority|Evidence URL|Blocker|Last Updated|Cycle ID|Task Template ID|Plan Version|Source IDs / Versions|Dependency Task IDs|Task Scope'.split('|')
SOURCES = 'Deliverable ID|Artist ID|Deliverable|Provided By|Requested Date|Due Date|Received Date|Status|Drive Evidence URL|Dependency / Next Action|Input Request ID|Source ID|Source Version|Validation Status|Cycle IDs|Reporting Period|Reviewed By|Reviewed At'.split('|')
APPROVALS = 'Approval ID|Artist ID|Decision / Item|Approver|Requested Date|Due Date|Status|Decision Date|Approval Evidence URL|Notes|Cycle ID|Plan Version|Gate ID|Source / Asset Version|Execution Evidence'.split('|')


def row(headers, **values):
    assert set(values) <= set(headers)
    return dict.fromkeys(headers, '') | values


def packet(cycle='DEMO-CYCLE-001'):
    tasks = json.loads((ROOT / 'templates/release-tasks.json').read_text())['tasks']
    inputs = json.loads((ROOT / 'templates/input-catalog.json').read_text())['requests']
    control = []
    for kind, domains in [('Cycle', ['']), ('Review', DOMAINS), ('Gate', ['G0', 'G1', 'G2', 'G3'])]:
        for domain in domains:
            control.append(row(CONTROL, **{'Record ID': f'{cycle}:{kind}:{domain}', 'Artist ID': 'DEMO-ARTIST', 'Cycle ID': cycle, 'Record Type': kind, 'Domain / Gate': domain, 'Plan Version': '1', 'Template Version': VERSION, 'Coordinator': 'Demo Coordinator', 'Status': 'Pending'}))
    return {
        'control': control,
        'tasks': [row(TASKS, **{'Task ID': f"{cycle}:{t['id']}", 'Artist ID': 'DEMO-ARTIST', 'Cycle ID': cycle, 'Task Template ID': t['id'], 'Task': t['title'], 'Workstream': t['domain'], 'Plan Version': '1', 'Task Scope': 'Release', 'Owner': 'Demo Worker', 'Status': 'Not Started', 'Dependency Task IDs': ';'.join(f'{cycle}:{d}' for d in t['dependencies'])}) for t in tasks],
        'sources': [row(SOURCES, **{'Deliverable ID': f"DEMO-DEL-{r['request_id']}", 'Artist ID': 'DEMO-ARTIST', 'Input Request ID': r['request_id'], 'Source ID': f"DEMO-SRC-{r['request_id']}", 'Source Version': '1', 'Cycle IDs': cycle, 'Status': 'Not Started', 'Validation Status': 'unverified'}) for r in inputs],
        'approvals': []
    }


class DriveContractTests(unittest.TestCase):
    def test_header_mapping_and_single_cycle(self):
        p = packet()
        self.assertEqual((len(p['control']), len(p['tasks']), len(p['sources'])), (12, 24, 18))
        self.assertEqual(len([r for r in p['control'] if r['Record Type'] == 'Review']), 7)
        ids = {r['Task ID'] for r in p['tasks']}
        self.assertEqual(len(ids), 24)
        for t in p['tasks']:
            self.assertTrue(t['Owner'])
            self.assertTrue(all(d in ids for d in t['Dependency Task IDs'].split(';') if d))
        for key, headers in [('control', CONTROL), ('tasks', TASKS), ('sources', SOURCES)]:
            self.assertTrue(all(list(r) == headers for r in p[key]))

    def test_happy_review_and_approval_evidence_roundtrip(self):
        p = packet()
        evidence = 'urn:demo:approval:G1:version1'
        decision = row(APPROVALS, **{'Status': 'Approved', 'Approval ID': 'DEMO-APP-001', 'Artist ID': 'DEMO-ARTIST', 'Cycle ID': 'DEMO-CYCLE-001', 'Plan Version': '1', 'Gate ID': 'G1', 'Approver': 'Demo Decider', 'Decision Date': '2026-10-10', 'Approval Evidence URL': evidence, 'Source / Asset Version': 'DEMO-SRC-REQ-01:1'})
        p['approvals'].append(decision)
        gate = next(r for r in p['control'] if r['Domain / Gate'] == 'G1')
        gate.update({'Status': 'Approved', 'Decision': 'Approved for this version', 'Reviewer / Decider': decision['Approver'], 'Decision Date': decision['Decision Date'], 'Evidence URL': evidence, 'Source IDs / Versions': decision['Source / Asset Version']})
        for review in (r for r in p['control'] if r['Record Type'] == 'Review'):
            review.update({'Status': 'Complete', 'Reviewer / Decider': 'Demo Reviewer', 'Decision': 'Demo recommendation', 'Evidence URL': 'urn:demo:review:' + review['Domain / Gate']})
        self.assertTrue(all(r['Status'] == 'Complete' and r['Reviewer / Decider'] and r['Decision'] and r['Evidence URL'] for r in p['control'] if r['Record Type'] == 'Review'))
        self.assertEqual(gate['Plan Version'], decision['Plan Version'])
        self.assertEqual(gate['Evidence URL'], decision['Approval Evidence URL'])
        self.assertEqual(gate['Reviewer / Decider'], decision['Approver'])
        self.assertFalse(decision['Execution Evidence'])  # decision is not execution

    def test_missing_input_remains_visible_not_done(self):
        p = packet()
        source = p['sources'][0]
        task = p['tasks'][0]
        task['Source IDs / Versions'] = source['Source ID'] + ':1'
        task['Blocker'] = 'Missing source evidence; manual review required'
        self.assertFalse(source['Drive Evidence URL'])
        self.assertFalse(source['Reviewed By'])
        self.assertTrue(task['Blocker'])
        self.assertFalse(task['Evidence URL'])
        self.assertEqual(task['Status'], 'Not Started')  # no invented completion

    def test_missing_or_rejected_approval_does_not_become_execution(self):
        p = packet()
        gates = [r for r in p['control'] if r['Record Type'] == 'Gate']
        self.assertTrue(all(not r['Decision'] and not r['Evidence URL'] for r in gates))
        gates[1]['Decision'] = 'DEMO REJECTION: not approved'
        self.assertFalse(p['approvals'])
        self.assertFalse(gates[2]['Decision'])

    def test_new_cycle_ids_separate_and_gates_not_copied(self):
        first, second = packet(), packet('DEMO-CYCLE-002')
        first['control'][-1]['Decision'] = 'DEMO prior decision'
        self.assertFalse({r['Task ID'] for r in first['tasks']} & {r['Task ID'] for r in second['tasks']})
        self.assertTrue(all(not r['Decision'] for r in second['control']))
        self.assertEqual(len(second['tasks']), 24)

    def test_source_change_and_handoff_keep_history_separate(self):
        p = packet()
        old_source = copy.deepcopy(p['sources'][0])
        new_source = copy.deepcopy(old_source)
        new_source['Source Version'] = '2'
        new_source['Reviewed By'] = ''
        self.assertNotEqual(old_source['Source Version'], new_source['Source Version'])
        task = p['tasks'][0]
        old_id = task['Task ID']
        task['Owner'] = 'Demo Worker Two'
        task['Blocker'] = 'Source v2 needs renewed review'
        self.assertEqual(task['Task ID'], old_id)
        self.assertFalse(new_source['Reviewed By'])


if __name__ == '__main__':
    unittest.main()
