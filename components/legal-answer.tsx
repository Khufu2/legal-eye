"use client";
import { Fragment } from "react";
import { evidenceLabels } from "@/lib/legal/citation-audit";

/** Render model text without trusting generated HTML or generated source URLs. */
export function LegalAnswer({ text, onCitation }: { text: string; onCitation?: (label: string) => void }) {
  const inline = (line: string) => line.split(/(\[[^\]\n]{1,200}\]|\([PF]\d+\b[^)\n]{0,198}\)|\*\*[^*]+\*\*)/g).map((part, index) => {
    const labels = evidenceLabels(part);
    if (labels.length && onCitation) return <Fragment key={index}>{part.slice(1,-1).split(/(\b[PF]\d+\b)/g).map((value,i)=>labels.includes(value)?<button key={i} className="evidence-link" onClick={() => onCitation(value)} aria-label={`Open source ${value}`}>{value}</button>:<Fragment key={i}>{value}</Fragment>)}</Fragment>;
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
