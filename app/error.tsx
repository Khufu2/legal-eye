'use client';
import { useEffect } from 'react';
import { track } from '@/lib/telemetry';
export default function WorkspaceError({reset}:{error:Error & {digest?:string};reset:()=>void}) {
  useEffect(()=>{track('locke_runtime_error',{code:'script_error'});},[]);
  return <main className="account-recovery"><section className="account-recovery-card"><h1>Let’s reconnect your workspace.</h1><p>LOCKE could not finish opening this page. Try again. If you were editing, check your last saved version before continuing.</p><button type="button" onClick={reset}>Try again</button><p><a href="/">Return to LOCKE home</a></p></section></main>;
}
