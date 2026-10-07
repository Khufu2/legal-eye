export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_LIMIT = 20_971_520;
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
export const DRIVE_MIMES = [GOOGLE_DOC_MIME, DOCX_MIME, 'application/pdf', 'text/plain', 'text/markdown'];

/** Only provider IDs from the user's picker selection; never accepts arbitrary URLs. */
export function driveDownload(id: string, mime: string, name: string) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error('Invalid Google file selection.');
  if (!DRIVE_MIMES.includes(mime)) throw new Error('Choose a Google document, PDF, DOCX or text file.');
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`;
  const doc = mime === GOOGLE_DOC_MIME;
  return {
    url: doc ? `${base}/export?mimeType=${encodeURIComponent(DOCX_MIME)}` : `${base}?alt=media`,
    mime: doc ? DOCX_MIME : mime,
    name: doc ? `${name.replace(/\.docx$/i, '')}.docx` : name,
  };
}

export async function readDriveFile(response: Response, name: string, mime: string) {
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google authorization expired. Choose the file again.');
    if (response.status === 403) throw new Error('Google denied access. Check file download permissions and the Drive API configuration.');
    throw new Error(`Google download failed (${response.status}). Choose the file again.`);
  }
  if (Number(response.headers.get('content-length') || 0) > DRIVE_LIMIT) throw new Error('Choose a file under 20 MB.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Google returned an empty download.');
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > DRIVE_LIMIT) throw new Error('Choose a file under 20 MB.');
      parts.push(new Uint8Array(item.value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  if (!size) throw new Error('This Google file is empty.');
  return new File(parts, name, {type: mime});
}
