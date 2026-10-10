import copy
import datetime as dt
import importlib.util
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('artist_os',ROOT/'artist_os.py')
w=importlib.util.module_from_spec(spec); spec.loader.exec_module(w)

class WorkflowTests(unittest.TestCase):
    def setUp(self): self.data=w.initialize('demo','Synthetic Artist','REL-DEMO-001','2026-11-27')
    def test_conditional_input_waiver(self):
        self.data['cycles'][0]['inputExceptions']=[{'inputId':'REQ-12','reason':'No paid campaign in this cycle','reviewedBy':'Synthetic reviewer','planVersion':1}]
        result=w.status(self.data,dt.date(2026,10,10))
        self.assertNotIn('REQ-12',result['cycles'][0]['missingInputs'])
    def test_rights_cannot_be_waived(self):
        self.data['cycles'][0]['inputExceptions']=[{'inputId':'REQ-07','reason':'Skip','reviewedBy':'demo','planVersion':1}]
        with self.assertRaises(ValueError): w.validate(self.data)
    def test_initialization_and_24_tasks(self):
        w.validate(self.data); self.assertEqual(len(self.data['cycles'][0]['tasks']),24)
    def test_exact_seven_reviews(self):
        self.data['cycles'][0]['reviews'].pop()
        with self.assertRaises(ValueError): w.validate(self.data)
    def test_duplicate_reviews_rejected(self):
        self.data['cycles'][0]['reviews'][0]['domain']='live'
        with self.assertRaises(ValueError): w.validate(self.data)
    def test_duplicate_cycle_rejected(self):
        self.data['cycles'].append(copy.deepcopy(self.data['cycles'][0]))
        with self.assertRaises(ValueError): w.validate(self.data)
    def test_missing_inputs_and_no_ready_work(self):
        r=w.status(self.data,dt.date(2026,10,10))
        self.assertEqual(r['cycles'][0]['nextTasks'],[])
        self.assertEqual(r['monthlyInputMissing'],'2026-09')
        self.assertIn('REQ-04',r['cycles'][0]['missingInputs'])
    def test_done_requires_evidence(self):
        self.data['cycles'][0]['tasks'][0]['state']='done'
        with self.assertRaises(ValueError): w.validate(self.data)
    def test_approval_requires_evidence(self):
        self.data['cycles'][0]['gates'][0]['state']='approved'
        with self.assertRaises(ValueError): w.validate(self.data)
    def test_gate_needs_seven_current_reviews(self):
        for g in self.data['cycles'][0]['gates']:
            g.update(state='approved',approvedBy='Synthetic reviewer',approvedAt='2026-10-10T00:00:00+00:00',evidence='synthetic decision')
        self.assertFalse(w.gate_ready(self.data['cycles'][0],'G1'))
    def test_template_references_and_acyclic(self):
        done=set()
        for t in w.TEMPLATE['tasks']:
            self.assertTrue(set(t['dependencies'])<=done)
            self.assertTrue(set(t['inputIds'])<=w.INPUT_IDS)
            done.add(t['id'])
    def test_no_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            command=[sys.executable,str(ROOT/'artist_os.py'),'add-artist','--id','demo','--name','Demo','--workspace',d]
            a=subprocess.run(command,capture_output=True); b=subprocess.run(command,capture_output=True)
            self.assertEqual(a.returncode,0); self.assertEqual(b.returncode,2)
    def test_invalid_path_id_rejected(self):
        with self.assertRaises(ValueError): w.initialize('../escape','Demo')
    def test_source_version_change_blocks(self):
        self.data['sources']=[{'id':'SRC-1','inputId':'REQ-04','version':2,'state':'valid','reference':'synthetic','verifiedBy':'demo','verifiedAt':'2026-10-10T00:00:00+00:00'}]
        self.data['cycles'][0]['sourceVersions']={'SRC-1':1}
        r=w.status(self.data,dt.date(2026,10,10))
        self.assertEqual(r['cycles'][0]['staleSources'],['SRC-1'])
    def test_old_done_task_does_not_unlock(self):
        c=self.data['cycles'][0]; c['planVersion']=2
        c['tasks'][0].update(state='done',evidence='synthetic receipt')
        r=w.status(self.data,dt.date(2026,10,10))['cycles'][0]
        self.assertIn('dependency:BYD-REL-T01',r['tasks'][1]['blockers'])
        self.assertEqual(r['tasks'][0]['readiness'],'blocked')
    def test_status_is_read_only_and_deterministic(self):
        original=copy.deepcopy(self.data); a=w.status(self.data,dt.date(2026,10,10)); b=w.status(self.data,dt.date(2026,10,10))
        self.assertEqual(a,b); self.assertEqual(self.data,original)
    def test_close_without_g3_rejected(self):
        self.data['cycles'][0]['closed']=True
        with self.assertRaises(ValueError): w.validate(self.data)
    def test_new_artist_has_no_invented_cycle(self):
        d=w.initialize('demo','Demo'); self.assertEqual(d['cycles'],[]); self.assertIsNone(d['artist']['careerStage'])

if __name__=='__main__': unittest.main()

