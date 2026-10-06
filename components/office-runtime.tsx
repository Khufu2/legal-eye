"use client";
import {useEffect} from 'react';

/** Office.js clears History methods; restore them before React/router work resumes. */
export function OfficeRuntime(){
 useEffect(()=>{
  let active=true;
  queueMicrotask(()=>{
   if(!active||document.querySelector('script[data-locke-office-runtime]'))return;
   const push=window.history.pushState,replace=window.history.replaceState;
   const script=document.createElement('script');script.dataset.lockeOfficeRuntime='true';
   script.src='https://appsforoffice.microsoft.com/lib/1/hosted/office.js';script.async=true;
   const restore=()=>{if(typeof window.history.pushState!=='function')window.history.pushState=push;if(typeof window.history.replaceState!=='function')window.history.replaceState=replace;};
   script.onload=restore;script.onerror=()=>{restore();script.remove();};
   document.head.appendChild(script);
  });
  return()=>{active=false;};
 },[]);
 return null;
}
