import crypto from "node:crypto";

const limit = Math.min(Math.max(Number(process.argv[2] || 20), 1), 20);
const feedUrl = "https://www.legislation.gov.uk/all/data.feed?sort=published&page=1";
const response = await fetch(feedUrl, { headers: { "user-agent": "LegalEye/0.1 (licensed corpus connector; contact=truckai.co@gmail.com)", accept: "application/atom+xml" } });
if (!response.ok) throw new Error(`UK Legislation returned ${response.status}`);
const xml = await response.text();
const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, limit).map(([, entry]) => {
  const text = (tag) => entry.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() || null;
  const attr = (tag, name) => entry.match(new RegExp(`<[^>]*${tag}[^>]*\\b${name}="([^"]+)"`))?.[1] || null;
  const id = text("id");
  const canonical = entry.match(/<link\s+href="([^"]+)"\s*\/>/)?.[1]?.replace(/^http:/, "https:") || id?.replace(/^http:/, "https:");
  const mainType = attr("DocumentMainType", "Value") || "Legislation";
  const year = attr("Year", "Value");
  const number = attr("Number", "Value");
  return {
    external_id: id,
    canonical_url: canonical,
    title: text("title"),
    published_at: text("published") || text("updated"),
    updated_at: text("updated"),
    document_type: mainType,
    citation: year && number ? `${mainType} ${year}/${number}` : null,
    entry_sha256: crypto.createHash("sha256").update(entry).digest("hex"),
    entry_xml: entry,
  };
}).filter((entry) => entry.external_id && entry.canonical_url && entry.title);
process.stdout.write(JSON.stringify({ feed_url: feedUrl, retrieved_at: new Date().toISOString(), entries }));
