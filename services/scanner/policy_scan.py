from __future__ import annotations

import stat
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

MAX_ARCHIVE_ENTRIES = 5000
MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024
MAX_ENTRY_BYTES = 100 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
MAX_XML_INSPECTION_BYTES = 8 * 1024 * 1024
EXECUTABLE_MAGIC = (b"MZ", b"\x7fELF", b"\xcf\xfa\xed\xfe", b"\xce\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xfe\xed\xfa\xce")
PDF_BLOCKED_TOKENS = (b"/javascript", b"/js", b"/launch", b"/openaction", b"/aa", b"/embeddedfile", b"/richmedia", b"/xfa")
OFFICE_BLOCKED_PATH_PARTS = ("vbaproject.bin", "/activex/", "/embeddings/", "/macrosheets/", "/controls/")
OFFICE_BLOCKED_SUFFIXES = (".exe", ".dll", ".com", ".scr", ".ps1", ".vbs", ".vbe", ".js", ".jse", ".jar", ".bat", ".cmd", ".lnk", ".chm", ".hta", ".msi")
XML_BLOCKED_TOKENS = (b"<!doctype", b"<!entity", b"javascript:", b"ms-msdt:", b"powershell:", b"cmd:", b"file://")
HTML_BLOCKED_TOKENS = (b"<script", b"<iframe", b"<object", b"<embed", b"<applet", b"javascript:", b"vbscript:", b"onload=", b"onerror=")


class ContentPolicyError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _reject(code: str, message: str) -> None:
    raise ContentPolicyError(code, message)


def _read_prefix(path: Path, size: int = 64 * 1024) -> bytes:
    with path.open("rb") as source:
        return source.read(size)


def _read_tail(path: Path, size: int = 64 * 1024) -> bytes:
    file_size = path.stat().st_size
    with path.open("rb") as source:
        if file_size > size:
            source.seek(file_size - size)
        return source.read(size)


def _scan_pdf(path: Path) -> dict[str, Any]:
    if not _read_prefix(path, 16).startswith(b"%PDF-"):
        _reject("pdf_magic_mismatch", "PDF signature is missing")
    if b"%%eof" not in _read_tail(path).lower():
        _reject("pdf_truncated", "PDF end marker is missing")
    overlap = b""
    with path.open("rb") as source:
        while True:
            block = source.read(1024 * 1024)
            if not block:
                break
            haystack = (overlap + block).lower()
            for token in PDF_BLOCKED_TOKENS:
                if token in haystack:
                    _reject("pdf_active_content", f"PDF contains blocked active content token {token.decode('ascii', 'ignore')}")
            overlap = haystack[-64:]
    return {"kind": "pdf"}


def _safe_zip_member(name: str) -> None:
    normalized = name.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or ".." in path.parts or normalized.startswith("/"):
        _reject("archive_path_traversal", "Archive contains an unsafe path")


def _scan_office(path: Path, expected: str | None) -> dict[str, Any]:
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as error:
        raise ContentPolicyError("office_archive_invalid", "Office document is not a valid OOXML archive") from error
    with archive:
        infos = archive.infolist()
        if len(infos) > MAX_ARCHIVE_ENTRIES:
            _reject("archive_entry_limit", "Office document contains too many archive entries")
        total_uncompressed = 0
        inspected_xml = 0
        names = {info.filename.replace("\\", "/").lower() for info in infos}
        if "[content_types].xml" not in names:
            _reject("office_content_types_missing", "OOXML content type manifest is missing")
        if expected == "docx" and not any(name.startswith("word/") for name in names):
            _reject("office_kind_mismatch", "Document is not a DOCX package")
        if expected == "xlsx" and not any(name.startswith("xl/") for name in names):
            _reject("office_kind_mismatch", "Document is not an XLSX package")
        if expected == "pptx" and not any(name.startswith("ppt/") for name in names):
            _reject("office_kind_mismatch", "Document is not a PPTX package")
        for info in infos:
            name = info.filename.replace("\\", "/")
            lower_name = f"/{name.lower().lstrip('/')}"
            _safe_zip_member(name)
            if stat.S_ISLNK(info.external_attr >> 16):
                _reject("archive_symlink", "Archive contains a symbolic link")
            if info.file_size > MAX_ENTRY_BYTES:
                _reject("archive_entry_too_large", "Archive entry exceeds the extraction limit")
            total_uncompressed += info.file_size
            if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
                _reject("archive_expansion_limit", "Archive expands beyond the safety limit")
            if info.compress_size > 0 and info.file_size > 1024 * 1024 and info.file_size / max(info.compress_size, 1) > MAX_COMPRESSION_RATIO:
                _reject("archive_compression_ratio", "Archive compression ratio is unsafe")
            if any(part in lower_name for part in OFFICE_BLOCKED_PATH_PARTS):
                _reject("office_active_content", f"Office package contains blocked active content: {name}")
            if lower_name.endswith(OFFICE_BLOCKED_SUFFIXES):
                _reject("office_embedded_executable", f"Office package contains blocked executable content: {name}")
            if inspected_xml < MAX_XML_INSPECTION_BYTES and info.file_size <= 2 * 1024 * 1024 and (lower_name.endswith(".xml") or lower_name.endswith(".rels")):
                try:
                    data = archive.read(info)
                except (RuntimeError, zipfile.BadZipFile) as error:
                    raise ContentPolicyError("office_entry_unreadable", "Office package contains an unreadable entry") from error
                inspected_xml += len(data)
                lowered = data.lower()
                if b"macroenabled" in lowered or b"vbaproject" in lowered:
                    _reject("office_macro_content", "Macro-enabled Office content is not accepted")
                for token in XML_BLOCKED_TOKENS:
                    if token in lowered:
                        _reject("office_external_action", f"Office XML contains blocked active reference {token.decode('ascii', 'ignore')}")
    return {"kind": expected or "ooxml"}


def _scan_html(path: Path) -> dict[str, Any]:
    with path.open("rb") as source:
        inspected = source.read(min(path.stat().st_size, 8 * 1024 * 1024)).lower()
    for token in HTML_BLOCKED_TOKENS:
        if token in inspected:
            _reject("html_active_content", f"HTML contains blocked active content {token.decode('ascii', 'ignore')}")
    return {"kind": "html"}


def _scan_plain_text(path: Path) -> dict[str, Any]:
    if b"\x00" in _read_prefix(path):
        _reject("text_binary_content", "Plain-text upload contains binary data")
    return {"kind": "text"}


def _scan_image(path: Path, suffix: str) -> dict[str, Any]:
    prefix = _read_prefix(path, 16)
    if suffix == ".png" and not prefix.startswith(b"\x89PNG\r\n\x1a\n"):
        _reject("image_magic_mismatch", "PNG signature is invalid")
    if suffix in {".jpg", ".jpeg"} and not prefix.startswith(b"\xff\xd8\xff"):
        _reject("image_magic_mismatch", "JPEG signature is invalid")
    if suffix in {".tif", ".tiff"} and not (prefix.startswith(b"II*\x00") or prefix.startswith(b"MM\x00*")):
        _reject("image_magic_mismatch", "TIFF signature is invalid")
    return {"kind": "image"}


def inspect_document(path: Path, file_name: str = "", content_type: str = "") -> dict[str, Any]:
    if path.stat().st_size <= 0:
        _reject("empty_document", "Document is empty")
    prefix = _read_prefix(path, 16)
    for magic in EXECUTABLE_MAGIC:
        if prefix.startswith(magic):
            _reject("executable_payload", "Executable payloads are not accepted")
    suffix = Path(file_name).suffix.lower()
    normalized = content_type.split(";", 1)[0].strip().lower()
    if prefix.startswith(b"%PDF-") or suffix == ".pdf" or normalized == "application/pdf":
        details = _scan_pdf(path)
    elif prefix.startswith(b"PK\x03\x04") or suffix in {".docx", ".xlsx", ".pptx"}:
        details = _scan_office(path, suffix.removeprefix(".") if suffix in {".docx", ".xlsx", ".pptx"} else None)
    elif suffix in {".html", ".htm"} or normalized in {"text/html", "application/xhtml+xml"}:
        details = _scan_html(path)
    elif suffix in {".txt", ".md", ".csv"} or normalized.startswith("text/"):
        details = _scan_plain_text(path)
    elif suffix in {".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
        details = _scan_image(path, suffix)
    else:
        _reject("unsupported_document_type", "Document type is not accepted for processing")
    return {"scanner": "legal-eye-content-policy-v1", "signature": None, "fallback": False, **details}
