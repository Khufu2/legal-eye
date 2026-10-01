"""Copy a reviewed Supabase storage inventory to private R2 and verify bytes.

No source mutations, deletion, traffic switches, or public URLs. Existing target
objects are verified, never overwritten. Each verified record is journaled.
Use only with a dedicated private, non-public R2 bucket and reviewed inventory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Source redirects are forbidden; credentials stay at Supabase")


def object_key(record):
    bucket, name = record.get("bucket_id"), record.get("name")
    if not isinstance(bucket, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", bucket):
        raise ValueError("Invalid source bucket")
    if not isinstance(name, str) or not name or any(p in ("", ".", "..") for p in name.split("/")):
        raise ValueError("Invalid source object path")
    if "\\" in name or any(ord(c) < 32 for c in name):
        raise ValueError("Invalid source object path")
    return f"supabase/{bucket}/{name}"


def hash_stream(body, limit, destination=None):
    digest, size = hashlib.sha256(), 0
    while chunk := body.read(1024 * 1024):
        size += len(chunk)
        if size > limit:
            raise ValueError("Object exceeds configured byte limit")
        digest.update(chunk)
        if destination is not None:
            destination.write(chunk)
    return size, digest.hexdigest()


def copy_and_verify(s3, target_bucket, record, source, limit):
    key = object_key(record)
    with tempfile.TemporaryFile() as staged:
        size, digest = hash_stream(source, limit, staged)
        expected = record.get("size")
        if expected is not None and size != int(expected):
            raise ValueError("Source size changed since inventory; export a fresh inventory")
        staged.seek(0)
        try:
            s3.head_object(Bucket=target_bucket, Key=key)
        except Exception as error:
            if getattr(error, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
                raise
            # Conditional create prevents a concurrent run overwriting another object.
            s3.put_object(Bucket=target_bucket, Key=key, Body=staged,
                          ContentLength=size, ContentType=record.get("mimetype") or "application/octet-stream",
                          CacheControl="private, no-store", IfNoneMatch="*",
                          Metadata={"sha256": digest})
        remote = s3.get_object(Bucket=target_bucket, Key=key)["Body"]
        try:
            copied_size, copied_digest = hash_stream(remote, limit)
        finally:
            remote.close()
        if (copied_size, copied_digest) != (size, digest):
            raise ValueError("R2 bytes differ; target left untouched, source retained")
    return {"source": record, "target_bucket": target_bucket, "target_key": key,
            "bytes": size, "sha256": digest, "verified_at": datetime.now(timezone.utc).isoformat()}


def append_receipt(path, receipt):
    flags = os.O_WRONLY | os.O_CREAT | os.O_APPEND | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "a") as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(json.dumps(receipt, ensure_ascii=True) + "\n")
        stream.flush()
        os.fsync(stream.fileno())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inventory", type=Path, help="Reviewed JSON array from storage.objects")
    parser.add_argument("--journal", type=Path, required=True)
    parser.add_argument("--max-object-bytes", type=int, default=256 * 1024 * 1024)
    parser.add_argument("--execute", action="store_true", help="Copy and verify; default validates only")
    args = parser.parse_args()
    if args.max_object_bytes <= 0:
        parser.error("max-object-bytes must be positive")
    records = json.loads(args.inventory.read_text())
    if not isinstance(records, list):
        parser.error("Inventory must be an array")
    keys = [object_key(record) for record in records]
    if len(set(keys)) != len(keys):
        parser.error("Duplicate source object keys")
    if not args.execute:
        print(json.dumps({"mode": "validate-only", "objects": len(records), "source_mutations": 0}))
        return
    import boto3
    account = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    if not re.fullmatch(r"[a-fA-F0-9]{32}", account):
        parser.error("Invalid Cloudflare account ID")
    base = os.environ["SUPABASE_URL"].rstrip("/")
    parsed = urlparse(base)
    if (parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".supabase.co")
            or parsed.username or parsed.password or parsed.port or parsed.path or parsed.query or parsed.fragment):
        parser.error("Use the project's HTTPS supabase.co URL")
    secret = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": secret}
    if not secret.startswith("sb_"):
        headers["Authorization"] = f"Bearer {secret}"
    s3 = boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                      aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                      aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto")
    target = os.environ["R2_MIGRATION_BUCKET"]
    opener = build_opener(NoRedirect())
    completed_bytes = 0
    for record in records:
        suffix = quote(record["bucket_id"], safe="") + "/" + quote(record["name"], safe="/")
        with opener.open(Request(f"{base}/storage/v1/object/authenticated/{suffix}", headers=headers), timeout=90) as source:
            receipt = copy_and_verify(s3, target, record, source, args.max_object_bytes)
        append_receipt(args.journal, receipt)
        completed_bytes += receipt["bytes"]
    print(json.dumps({"verified_objects": len(records), "verified_bytes": completed_bytes,
                      "source_mutations": 0, "traffic_switched": False}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # SDK errors can contain request URLs/identifiers. Keep public logs minimal.
        print(json.dumps({"failed": True, "error_type": type(error).__name__,
                          "source_mutations": 0, "traffic_switched": False}))
        raise SystemExit(1)
