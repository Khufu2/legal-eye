from pathlib import Path

path = Path('services/docling/worker.py')
text = path.read_text()
text = text.replace(
'''    def __init__(self, base_url: str, secret_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        headers = {"apikey": secret_key}
''',
'''    def __init__(self, base_url: str, secret_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.secret_key = secret_key
        headers = {"apikey": secret_key}
''',
1,
)
text = text.replace(
'''        if response.status_code >= 400:
            raise PipelineError(
                "supabase_request_failed",
                f"Supabase operation failed ({response.status_code})",
                response.status_code >= 500 or response.status_code == 429,
            )
''',
'''        if response.status_code >= 400:
            safe_path = path.split("?", 1)[0]
            LOGGER.error(
                "Supabase operation failed: method=%s path=%s status=%s",
                method.upper(),
                safe_path,
                response.status_code,
            )
            raise PipelineError(
                "supabase_request_failed",
                f"Supabase {method.upper()} {safe_path} failed ({response.status_code})",
                response.status_code >= 500 or response.status_code == 429,
            )
''',
1,
)
text = text.replace(
'''    def storage_download(self, bucket: str, path: str, target: Path) -> tuple[str, str]:
        encoded_path = "/".join(encoded(part) for part in path.split("/"))
        with self.client.stream("GET", f"{self.base_url}/storage/v1/object/{encoded(bucket)}/{encoded_path}") as response:
''',
'''    def storage_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = dict(extra or {})
        # Supabase Storage authenticates through Authorization. The new opaque
        # sb_secret_* key is safe here because this worker is server-side only.
        headers["authorization"] = f"Bearer {self.secret_key}"
        return headers

    def storage_download(self, bucket: str, path: str, target: Path) -> tuple[str, str]:
        encoded_path = "/".join(encoded(part) for part in path.split("/"))
        with self.client.stream(
            "GET",
            f"{self.base_url}/storage/v1/object/{encoded(bucket)}/{encoded_path}",
            headers=self.storage_headers(),
        ) as response:
''',
1,
)
text = text.replace(
'''        self.request(
            "POST",
            f"/storage/v1/object/{encoded(bucket)}/{encoded_path}",
            content=content,
            headers={"content-type": content_type, "x-upsert": "true"},
        )
''',
'''        self.request(
            "POST",
            f"/storage/v1/object/{encoded(bucket)}/{encoded_path}",
            content=content,
            headers=self.storage_headers({"content-type": content_type, "x-upsert": "true"}),
        )
''',
1,
)
path.write_text(text)
print('patched Storage authorization and safe Supabase failure diagnostics')
