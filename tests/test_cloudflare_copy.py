import importlib.util
import io
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("copy_storage", Path(__file__).parents[1] / "scripts/cloudflare/copy_storage.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Missing(Exception):
    response = {"ResponseMetadata": {"HTTPStatusCode": 404}}


class Store:
    def __init__(self, value=None, corrupt=False):
        self.value, self.corrupt, self.puts = value, corrupt, 0

    def head_object(self, **kwargs):
        if self.value is None:
            raise Missing()
        return {}

    def put_object(self, **kwargs):
        assert kwargs["IfNoneMatch"] == "*"
        assert kwargs["CacheControl"] == "private, no-store"
        self.puts += 1
        self.value = kwargs["Body"].read()

    def get_object(self, **kwargs):
        return {"Body": io.BytesIO(b"corrupt" if self.corrupt else self.value)}


class CopyTests(unittest.TestCase):
    record = {"id": "source-id", "bucket_id": "firm-vault", "name": "org/file.pdf", "size": 5}

    def test_copy_preserves_bytes_and_source_identity(self):
        store = Store()
        receipt = module.copy_and_verify(store, "private", self.record, io.BytesIO(b"legal"), 100)
        self.assertEqual(store.value, b"legal")
        self.assertEqual(receipt["source"], self.record)
        self.assertEqual(receipt["target_key"], "supabase/firm-vault/org/file.pdf")
        self.assertEqual(receipt["bytes"], 5)

    def test_resume_revalidates_existing_target(self):
        store = Store(b"legal")
        module.copy_and_verify(store, "private", self.record, io.BytesIO(b"legal"), 100)
        self.assertEqual(store.puts, 0)

    def test_corruption_cannot_be_verified(self):
        with self.assertRaises(ValueError):
            module.copy_and_verify(Store(corrupt=True), "private", self.record, io.BytesIO(b"legal"), 100)

    def test_changed_source_never_overwrites_target(self):
        store = Store(b"older")
        with self.assertRaises(ValueError):
            module.copy_and_verify(store, "private", self.record, io.BytesIO(b"legal"), 100)
        self.assertEqual(store.value, b"older")
        self.assertEqual(store.puts, 0)

    def test_inventory_size_change_refuses_copy(self):
        store = Store()
        with self.assertRaises(ValueError):
            module.copy_and_verify(store, "private", self.record, io.BytesIO(b"longer"), 100)
        self.assertEqual(store.puts, 0)

    def test_object_size_budget(self):
        with self.assertRaises(ValueError):
            module.hash_stream(io.BytesIO(b"123456"), 5)

    def test_invalid_paths(self):
        for name in ("../secret", "/file", "org//file", "org/./file", "org\\file", "bad\nfile"):
            with self.assertRaises(ValueError):
                module.object_key({"bucket_id": "firm-vault", "name": name})

    def test_redirects_refused(self):
        with self.assertRaises(RuntimeError):
            module.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.example")

    def test_journal_private_and_durable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "receipt.jsonl"
            module.append_receipt(path, {"verified": True})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(path.read_text(), '{"verified": true}\n')


if __name__ == "__main__":
    unittest.main()
