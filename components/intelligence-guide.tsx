"use client";

import { CheckCircle2 } from "lucide-react";

export function IntelligenceGuide({
  title,
  steps,
}:{
  title:string;
  steps:Array<{title:string;detail:string}>;
}) {
  return <section className="intelligence-guide" aria-label={title}>
    <div className="intelligence-guide-title"><CheckCircle2/><span>{title}</span></div>
    <div className="intelligence-guide-steps">
      {steps.map((step,index)=><div key={step.title}><i>{index+1}</i><span><b>{step.title}</b><small>{step.detail}</small></span></div>)}
    </div>
  </section>;
}
