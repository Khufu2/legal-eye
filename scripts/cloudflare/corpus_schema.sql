-- Public legal corpus only. Private firm records stay outside this database.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sources (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 base_url TEXT NOT NULL,
 policy_state TEXT NOT NULL DEFAULT 'review_required' CHECK(policy_state IN ('approved','review_required','blocked')),
 permanent_storage_allowed INTEGER NOT NULL DEFAULT 0 CHECK(permanent_storage_allowed IN (0,1)),
 commercial_display_allowed INTEGER NOT NULL DEFAULT 0 CHECK(commercial_display_allowed IN (0,1)),
 attribution TEXT NOT NULL,
 approval_basis TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
 id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL REFERENCES sources(id),
 external_id TEXT NOT NULL,
 jurisdiction TEXT NOT NULL,
 title TEXT NOT NULL,
 citation TEXT,
 document_type TEXT NOT NULL,
 canonical_url TEXT NOT NULL,
 published_at TEXT,
 retrieved_at TEXT NOT NULL,
 content_sha256 TEXT NOT NULL CHECK(length(content_sha256)=64),
 raw_r2_key TEXT NOT NULL,
 extracted_r2_key TEXT,
 parser_version TEXT,
 status TEXT NOT NULL CHECK(status IN ('pending','indexed','failed','withdrawn')),
 UNIQUE(source_id, external_id)
);
CREATE INDEX IF NOT EXISTS documents_scope ON documents(jurisdiction,status,document_type);
CREATE TABLE IF NOT EXISTS chunks (
 rowid INTEGER PRIMARY KEY,
 id TEXT NOT NULL UNIQUE,
 document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 reading_order INTEGER NOT NULL,
 content TEXT NOT NULL CHECK(length(content)>0 AND length(content)<=12000),
 page_number INTEGER,
 source_node_ref TEXT NOT NULL,
 start_offset INTEGER,
 end_offset INTEGER,
 UNIQUE(document_id,reading_order)
);
CREATE INDEX IF NOT EXISTS chunks_document ON chunks(document_id,reading_order);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(content,content='chunks',content_rowid='rowid',tokenize='unicode61');
CREATE TRIGGER IF NOT EXISTS chunks_insert AFTER INSERT ON chunks BEGIN
 INSERT INTO chunks_fts(rowid,content) VALUES(new.rowid,new.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_delete AFTER DELETE ON chunks BEGIN
 INSERT INTO chunks_fts(chunks_fts,rowid,content) VALUES('delete',old.rowid,old.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_update AFTER UPDATE ON chunks BEGIN
 INSERT INTO chunks_fts(chunks_fts,rowid,content) VALUES('delete',old.rowid,old.content);
 INSERT INTO chunks_fts(rowid,content) VALUES(new.rowid,new.content);
END;
CREATE TABLE IF NOT EXISTS ingestion_state (
 source_id TEXT NOT NULL REFERENCES sources(id),
 collection TEXT NOT NULL,
 cursor TEXT,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(source_id,collection)
);
