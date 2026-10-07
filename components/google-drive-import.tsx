"use client";
import Script from 'next/script';
import {useEffect, useRef, useState} from 'react';
import {Button} from '@/components/ui/button';
import {DRIVE_MIMES, DRIVE_SCOPE, driveDownload, readDriveFile} from '@/lib/legal/google-drive';

type Config = {clientId: string; apiKey: string; appId: string};
const googleApi = () => (window as unknown as {google?: any; gapi?: any});

/** One-shot, user-selected import. Google credentials stay in memory, never in LOCKE storage. */
export function GoogleDriveImport({enabled, busy, contextKey, onFile}: {
  enabled: boolean; busy: boolean; contextKey: string; onFile: (file: File) => Promise<unknown>;
}) {
  const [config, setConfig] = useState<Config | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [gisReady, setGisReady] = useState(false), [pickerReady, setPickerReady] = useState(false);
  const [working, setWorking] = useState(false), [message, setMessage] = useState('');
  const revision = useRef(0), token = useRef(''), picker = useRef<any>(null);
  const active = useRef(true), signInTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    fetch('/api/connections/google', {signal: controller.signal, cache: 'no-store'})
      .then(r => {if (!r.ok) throw new Error('Could not check Google setup.'); return r.json();})
      .then(c => {setConfigured(c.configured); if (c.configured) setConfig(c);})
      .catch(e => {if (e.name !== 'AbortError') {setConfigured(false); setMessage(e.message);}});
    return () => {active.current = false; revision.current++; controller.abort(); picker.current?.setVisible(false); if(signInTimeout.current) clearTimeout(signInTimeout.current); revoke(token.current);};
  }, []);
  useEffect(() => {revision.current++; revoke(token.current); if(signInTimeout.current) clearTimeout(signInTimeout.current); picker.current?.setVisible(false); setWorking(false); setMessage('');}, [contextKey]);
  const revoke = (value: string) => {if(value) googleApi().google?.accounts?.oauth2?.revoke(value, () => {}); token.current = '';};
  function choose() {
    if (!config || !enabled || busy || working) return;
    const current = revision.current;
    const valid = () => active.current && current === revision.current;
    const api = googleApi().google;
    setMessage(''); setWorking(true);
    signInTimeout.current = setTimeout(() => {if(valid()) {revision.current++; setWorking(false); setMessage('Google sign-in did not finish. Close the old popup, allow pop-ups, then choose the file again.');}}, 60000);
    try {
      const client = api.accounts.oauth2.initTokenClient({
        client_id: config.clientId, scope: DRIVE_SCOPE, include_granted_scopes: false,
        error_callback: (e: {type?: string}) => {if(signInTimeout.current) clearTimeout(signInTimeout.current); if (valid()) {setWorking(false); setMessage(e.type === 'popup_closed' ? 'Google sign-in was closed. Try again when ready.' : 'Google sign-in could not open. Allow pop-ups for LOCKE and try again.');}},
        callback: (response: {access_token?: string; error?: string}) => {
          if(signInTimeout.current) clearTimeout(signInTimeout.current);
          if (!valid()) {if(response.access_token) revoke(response.access_token); return;}
          if (response.error || !response.access_token || !api.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
            if(response.access_token) revoke(response.access_token);
            setWorking(false); setMessage('Google did not authorize selected-file access. Choose again and review the permission request.'); return;
          }
          const grant = response.access_token;
          token.current = grant;
          try {
            const view = new api.picker.DocsView(api.picker.ViewId.DOCS).setMimeTypes(DRIVE_MIMES.join(','));
            picker.current = new api.picker.PickerBuilder().setDeveloperKey(config.apiKey).setAppId(config.appId)
              .setOAuthToken(response.access_token).setOrigin(window.location.origin).addView(view)
              .setTitle('Choose a document to copy into your firm vault')
              .setCallback(async (data: {action: string; docs?: Array<{id: string; mimeType: string; name: string}>}) => {
                if (data.action === api.picker.Action.CANCEL) {revoke(grant); if(valid()) setWorking(false); return;}
                if (data.action !== api.picker.Action.PICKED || !data.docs?.[0]) return;
                if (!valid()) return;
                try {
                  setMessage('Downloading the selected file…');
                  const selected = data.docs[0], download = driveDownload(selected.id, selected.mimeType, selected.name);
                  const result = await fetch(download.url, {headers: {Authorization: `Bearer ${grant}`}, signal: AbortSignal.timeout(60000)});
                  const file = await readDriveFile(result, download.name, download.mime);
                  if (!valid()) return;
                  setMessage('Securing the copy in your firm vault…');
                  const saved = await onFile(file);
                  if(valid()) setMessage(saved === false ? 'The import could not complete. Check the vault error below.' : 'Import complete. The original Google file is unchanged.');
                } catch(e) {if(valid()) setMessage(e instanceof Error ? e.message : 'Google import failed.');}
                finally {revoke(grant); if(valid()) setWorking(false);}
              }).build();
            picker.current.setVisible(true);
          } catch(e) {revoke(token.current); setWorking(false); setMessage(e instanceof Error ? e.message : 'The Google file picker could not open.');}
        },
      });
      client.requestAccessToken({prompt: 'consent'});
    } catch(e) {if(signInTimeout.current) clearTimeout(signInTimeout.current); setWorking(false); setMessage(e instanceof Error ? e.message : 'Google sign-in failed.');}
  }
  return <div className="google-import">
    {config && <><Script src="https://accounts.google.com/gsi/client" onReady={() => setGisReady(true)}/>
      <Script src="https://apis.google.com/js/api.js" onReady={() => googleApi().gapi?.load('picker', {callback: () => setPickerReady(true), onerror: () => setMessage('Google Picker could not load. Reload and try again.'), timeout: 15000, ontimeout: () => setMessage('Google Picker took too long to load. Reload and try again.')})}/></>}
    <Button variant="outline" disabled={!enabled || busy || working || !configured || !gisReady || !pickerReady} onClick={choose}>{working ? 'Importing…' : 'Import from Google Drive'}</Button>
    <a href="/connections">{configured === false ? 'Google setup required' : 'Connection setup'}</a>
    {message && <p role="status">{message}</p>}
  </div>;
}
