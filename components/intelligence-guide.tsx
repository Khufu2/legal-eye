"use client";

import { Compass } from "lucide-react";

export function IntelligenceGuide({
  title,
  steps,
}:{
  title:string;
  steps:Array<{title:string;detail:string}>;
}) {
  return <details className="intelligence-guide" aria-label={title}>
    <summary className="intelligence-guide-title"><Compass/><span><b>{title}</b><small>Open the step-by-step guide</small></span></summary>
    <div className="intelligence-guide-steps">
      {steps.map((step,index)=><div key={step.title}><i>{index+1}</i><span><b>{step.title}</b><small>{step.detail}</small></span></div>)}
    </div>
  </details>;
}
