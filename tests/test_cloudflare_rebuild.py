import importlib.util, json, os, pathlib, tempfile, unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cloudflare_rebuild',ROOT/'scripts/cloudflare/ingest_sources.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class CloudflareRebuildTests(unittest.TestCase):
 def test_streamed_index_limits_postings_and_preserves_snapshot_counts(self):
  with tempfile.TemporaryDirectory() as folder,patch.dict(os.environ,{'LOCKE_CORPUS_INGEST_TOKEN':'unit-test'}):
   runner=module.Rebuild('https://locke-corpus.ivogeraldladjr.workers.dev','unused',folder+'/db.sqlite')
   for n in range(260):
    doc={'title':'Employment' if n==259 else 'General provision','citation':None,'chunks':[{'content':'Employment notice'}],'jurisdiction_code':'TZ'}
    runner.db.execute('INSERT INTO documents VALUES (?,?,?,?,?,?,?,?)',(str(n),'TZ',str(n),'hash','documents/'+str(n),doc['title'],1,json.dumps(doc)))
   runner.db.commit();calls=[]
   runner.call=lambda path,method='POST',**kwargs:calls.append((path,kwargs.get('json'))) or {'verified':True}
   runner.publish()
   manifest=next(body for path,body in calls if path=='/publish')
   self.assertEqual(manifest['documents'],260);self.assertEqual(manifest['counts'],{'TZ':260})
   shard=next(body['data'] for path,body in calls if path=='/index' and 'employment' in body['data'])
   self.assertEqual(len(shard['employment']),256);self.assertEqual(shard['employment'][0][0],'documents/259')
   self.assertEqual(sum(path=='/index' for path,_ in calls),256)
   runner.client.close();runner.db.close()

 def test_remote_verification_failure_never_creates_success_receipt(self):
  with tempfile.TemporaryDirectory() as folder,patch.dict(os.environ,{'LOCKE_CORPUS_INGEST_TOKEN':'unit-test'}):
   runner=module.Rebuild('https://locke-corpus.ivogeraldladjr.workers.dev','unused',folder+'/db.sqlite')
   runner.call=lambda *args,**kwargs:{'verified':True,'content_sha256':'wrong-hash'}
   doc={'external_id':'synthetic','title':'Synthetic','jurisdiction_code':'UK','canonical_url':'https://www.legislation.gov.uk/synthetic'}
   with self.assertRaisesRegex(ValueError,'Remote verification mismatch'):runner.ingest(doc,b'<Text>'+b'notice '*30+b'</Text>','application/xml')
   self.assertEqual(runner.db.execute('SELECT count(*) FROM documents').fetchone()[0],0)
   runner.client.close();runner.db.close()

if __name__=='__main__':unittest.main()
