"""Bounded ingestion of published e-Maktaba judgment PDFs from a captured catalogue.

Only legal metadata is retained. Source summaries are not ingested as judgments.
Run with a verified restored ledger; a receipt alone is not legal validation.
"""
import argparse, concurrent.futures, json, pathlib, re
from ingest_sources import Rebuild

HOST = 'https://emaktaba.judiciary.go.tz'

def documents(rows):
    result = []
    for row in rows:
        ident = str(row.get('id', ''))
        path = row.get('documentUrl', '')
        title = row.get('case_name')
        if row.get('visibility') != 'published' or not title or not re.fullmatch(r'[a-z0-9]+', ident):
            continue
        if not isinstance(path, str) or not re.fullmatch(r'/uploads/[a-zA-Z0-9_-]+\.pdf', path):
            continue
        court = row.get('courtName')
        result.append({
            'external_id': 'judiciary:' + ident, 'jurisdiction_code': 'TZ',
            'title': str(title)[:1000], 'citation': row.get('media_neutral_citations'),
            'court': court.get('courtName') if isinstance(court, dict) else row.get('court_level'),
            'document_type': 'judgment', 'canonical_url': HOST + '/judgements/' + ident,
            'source_url': HOST + path,
            'published_at': str(row.get('decision_date') or '').removeprefix('$D') or None,
            'version_notice': 'Published judgment PDF; citation metadata and authority treatment require lawyer verification.',
        })
    return list({doc['external_id']: doc for doc in result}.values())

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--catalogue-json', required=True)
    p.add_argument('--database', required=True)
    p.add_argument('--secrets', default='work/cloudflare-operator.json')
    p.add_argument('--limit', type=int, default=50)
    p.add_argument('--workers', type=int, default=3)
    args = p.parse_args()
    rows = json.loads(pathlib.Path(args.catalogue_json).read_text())
    docs = documents(rows)
    runner = Rebuild('https://locke-corpus.ivogeraldladjr.workers.dev', args.secrets, args.database)
    have = {row[0] for row in runner.db.execute("select external_id from documents where jurisdiction='TZ'")}
    priority = re.compile(r'employment|labour|labor|land|contract|commercial|company|companies|arbitration', re.I)
    docs = sorted((doc for doc in docs if doc['external_id'] not in have), key=lambda d: str(d['published_at'] or ''), reverse=True)
    docs.sort(key=lambda d: not bool(priority.search(d['title'])))
    docs = docs[:max(1, min(args.limit, 100))]
    print(json.dumps({'eligible_published_pdf_records': len(documents(rows)), 'batch': len(docs)}), flush=True)
    def ingest(doc):
        try:
            raw, mime = runner.fetch(doc['source_url'], {'emaktaba.judiciary.go.tz'})
            if not raw.startswith(b'%PDF-'):
                raise ValueError('Expected judgment PDF, not a website or summary')
            receipt = runner.ingest(doc, raw, mime)
            return doc, receipt
        except Exception as error:
            print(json.dumps({'external_id': doc['external_id'], 'state': 'source_unavailable', 'error': type(error).__name__}), flush=True)
            return doc, None
    verified = published = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
        for doc, receipt in pool.map(ingest, docs):
            if not receipt:
                continue
            verified += 1
            try:
                runner.publish_delta(receipt)
                published += 1
                print(json.dumps({'external_id': doc['external_id'], 'verified': True, 'search_published': True}), flush=True)
            except Exception as error:
                print(json.dumps({'external_id': doc['external_id'], 'verified': True, 'search_published': False, 'error': type(error).__name__}), flush=True)
    print(json.dumps({'verified': verified, 'search_published': published, 'all_judgments_complete': False}), flush=True)

if __name__ == '__main__':
    main()
