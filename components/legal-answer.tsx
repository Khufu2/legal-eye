"use client";
import { Fragment } from "react";

/** Render model text without trusting generated HTML or generated source URLs. */
export function LegalAnswer({ text, onCitation }: { text: string; onCitation?: (label: string) => void }) {
  const inline = (line: string) => line.split(/(\[(?:P|F)\d+\]|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (/^\[(P|F)\d+\]$/.test(part)) return <button key={index} className="evidence-link" onClick={() => onCitation?.(part.slice(1, -1))} aria-label={`Open source ${part.slice(1, -1)}`}>{part.slice(1, -1)}</button>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return <Fragment key={index}>{part}</Fragment>;
  });
  return <div className="legal-prose">{text.split(/\n\s*\n/).map((block, index) => {
    if (/^#{1,4}\s/.test(block)) return <h3 key={index}>{inline(block.replace(/^#{1,4}\s/, ""))}</h3>;
    const lines = block.split("\n");
    if (lines.every(line => /^\s*[-*]\s/.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s/, ""))}</li>)}</ul>;
    if (lines.every(line => /^\s*\d+[.)]\s/.test(line))) return <ol key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*\d+[.)]\s/, ""))}</li>)}</ol>;
    return <p key={index}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br/>}{inline(line)}</Fragment>)}</p>;
  })}</div>;
}
