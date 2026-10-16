'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/telemetry';
export function LockeTelemetry() {
  const path=usePathname();
  useEffect(()=>{const screen=path==='/'?'workspace':path==='/reset-password'?'recovery':path==='/connections'?'connections':path==='/office/word'?'word':path==='/office/outlook'?'outlook':path?.startsWith('/portal/')?'portal':'other';track('locke_page_viewed',{screen});},[path]);
  useEffect(()=>{
    const error=()=>track('locke_runtime_error',{code:'script_error'});
    const rejection=()=>track('locke_runtime_error',{code:'unhandled_rejection'});
    window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);
    return()=>{window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);};
  },[]);
  return null;
}
