"""Coverage for pagination, failure checkpoints and access-denial handling."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import httpx

spec = importlib.util.spec_from_file_location('worker', Path(__file__).parents[1] / 'services/open-corpus/worker.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
FEED = '''<feed xmlns="http://www.w3.org/2005/Atom"><link rel="next" href="http://www.legislation.gov.uk/all/data.feed?page=2"/><entry><id>law:1</id><title>Test law</title><link type="application/xml" href="http://www.legislation.gov.uk/uksi/2026/1/made/data.xml"/></entry><entry><id>law:2</id><title>PDF only</title></entry></feed>'''

class FakeApi:
    def __init__(self, fail=False):
        self.state = {}
        def respond(request):
            if 'data.feed' in str(request.url):
                return httpx.Response(200, text=FEED)
            return httpx.Response(503 if fail else 200, text='<Legislation><Text>Test provision</Text></Legislation>')
        self.client = httpx.Client(transport=httpx.MockTransport(respond))
    def rows(self, *args): return [self.state] if self.state else []
    def upsert(self, table, conflict, rows): self.state = rows[0]
    def patch(self, *args): pass

class IngestionTests(unittest.TestCase):
    def test_links_and_pdf_gap(self):
        entries, next_url = w.uk_feed(FEED)
        self.assertTrue(entries[0]['xml_url'].startswith('https://'))
        self.assertIsNone(entries[1]['xml_url'])
        self.assertTrue(next_url.endswith('page=2'))
    def test_untrusted_links_and_entities_rejected(self):
        for url in ['https://evil.test/data.xml', 'https://user@www.legislation.gov.uk/data.xml']:
            with self.assertRaises(ValueError): w.uk_url(url)
        with self.assertRaises(ValueError): w.uk_feed('<!ENTITY x "bad">')
    def test_resume_and_next_page(self):
        api = FakeApi()
        with patch.object(w, 'persist_document') as persist:
            self.assertEqual(w.process_uk(api, {'id':'uk'}, 1), 1)
            self.assertEqual(api.state['cursor']['uk_entry_offset'], 1)
            self.assertEqual(w.process_uk(api, {'id':'uk'}, 1), 0)
            self.assertEqual(persist.call_count, 1)
        self.assertEqual(api.state['cursor']['uk_non_xml_entries'], 1)
        self.assertTrue(api.state['cursor']['uk_next_feed'].endswith('page=2'))
    def test_failed_document_does_not_advance(self):
        api = FakeApi(fail=True)
        with self.assertRaises(httpx.HTTPStatusError): w.process_uk(api, {'id':'uk'}, 1)
        self.assertEqual(api.state, {})
    def test_access_denied_preserves_checkpoint_and_blocks(self):
        api = FakeApi()
        api.state = {'cursor':{'offset':7560}}
        response = httpx.Response(403, request=httpx.Request('GET','https://example.test'))
        error = httpx.HTTPStatusError('Denied', request=response.request, response=response)
        w.record_failure(api, {'id':'au'}, error)
        self.assertEqual(api.state['cursor']['offset'], 7560)
        self.assertFalse(w.source_ready(api, {'id':'au'}))
        self.assertEqual(api.state['consecutive_failures'], 1)

if __name__ == '__main__': unittest.main()
