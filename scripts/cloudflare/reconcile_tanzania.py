"""Reconcile the declared OAG catalogue against verified R2 ingestion receipts.
This does not claim coverage of courts, unlisted laws or amendment effect.
"""
import argparse,concurrent.futures,json,pathlib,re,sqlite3
from datetime import datetime,timezone
from urllib.parse import quote
import httpx
COLLECTIONS=[('acts','acts-ajax'),('revised_acts','revised-acts-ajax'),('subsidiary_legislation','legislation-ajax'),('annual_supplements','annual-supplements-ajax'),('bills','bills-ajax'),('guidelines','guidelines-ajax'),('parliamentary_resolutions','bills-specific-resolutions'),('international_instruments','bills-international-resolutions')]
def reconcile(database):
 conn=sqlite3.connect(database);indexed={r[0] for r in conn.execute("select external_id from documents where jurisdiction='TZ'")};conn.close()
 def check(pair):
  collection,endpoint=pair
  try:
   with httpx.Client(timeout=45,follow_redirects=False) as client:
    r=client.get('https://oagmis.oag.go.tz/portal/'+endpoint);r.raise_for_status()
    if len(r.content)>32*1024*1024:raise ValueError('Catalogue exceeds bounded size')
    rows=r.json()['data']
   available=[];no_file=[];unpublished=0
   for item in rows:
    if item.get('published') is False:unpublished+=1;continue
    ident=f'oag:{collection}:{item["id"]}';path=next((v for k,v in item.items() if re.search(r'(doc|file).*path|path.*(doc|file)',k,re.I) and isinstance(v,str) and v),None)
    (available if path and '..' not in path else no_file).append(ident)
   missing=[ident for ident in available if ident not in indexed]
   return {'collection':collection,'source_records':len(rows),'published_downloadable':len(available),'verified_indexed':len(available)-len(missing),'missing_ids':missing,'no_download_ids':no_file,'unpublished':unpublished,'state':'reconciled'}
  except Exception as e:return {'collection':collection,'state':'unavailable','error':type(e).__name__}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:collections=list(pool.map(check,COLLECTIONS))
 return {'checked_at':datetime.now(timezone.utc).isoformat(),'jurisdiction':'TZ','scope':'OAG published downloadable catalogue only','collections':collections,'catalogue_complete':all(c['state']=='reconciled' and not c['missing_ids'] for c in collections),'all_law_complete':False,'judgment_coverage_verified':False,'amendment_effect_verified':False}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--database',required=True);parser.add_argument('--output',required=True);args=parser.parse_args();result=reconcile(args.database);pathlib.Path(args.output).write_text(json.dumps(result,indent=2));print(json.dumps({'collections':result['collections'],'catalogue_complete':result['catalogue_complete'],'all_law_complete':False}))
