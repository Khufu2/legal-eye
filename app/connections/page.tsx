import './connections.css';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export default function ConnectionsPage() {
  const googleReady = Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_PICKER_API_KEY && process.env.GOOGLE_CLOUD_PROJECT_NUMBER);
  return <main className="connections-shell">
    <header><Link href="/">Locke</Link><Link href="/">Back to workspace ↗</Link></header>
    <div className="connections-intro"><span className="eyebrow">Workspace connections</span><h1>Your tools, your accounts.</h1><p>Each lawyer uses their own account. Your firm administrator can approve and deploy the Office add-ins for the team.</p></div>
    <div className="connections-grid">
      <section><span className="eyebrow">Microsoft Word</span><h2>Work inside a document</h2><p>The browser preview is for pasted text. To read and replace a selection, open LOCKE inside Word.</p>
        <a className="connection-action" href="/office/word-manifest.xml" download>Download Word add-in</a>
        <ol><li>Open a document in Word on the web using your Microsoft account.</li><li>Select Home → Add-ins → More Settings → Upload My Add-in.</li><li>Upload the downloaded XML file. Open LOCKE and sign in to your LOCKE firm workspace.</li><li>Select a passage, choose Load selection, then review the proposal before applying it.</li></ol>
        <a href="https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing" target="_blank" rel="noreferrer">Microsoft installation guide ↗</a>
      </section>
      <section><span className="eyebrow">Microsoft Outlook</span><h2>Draft in the current email</h2><p>Install LOCKE in your own mailbox. Generated replies are drafts for you to review.</p>
        <a className="connection-action" href="/office/outlook-manifest.xml" download>Download Outlook add-in</a>
        <ol><li>Open <a href="https://aka.ms/olksideload" target="_blank" rel="noreferrer">Add-Ins for Outlook</a> and sign in.</li><li>Select My add-ins → Custom Addins → Add a custom add-in → Add from File.</li><li>Upload the downloaded XML file. Open an email, launch LOCKE, and sign in to LOCKE.</li><li>Load the email, draft your reply, review it, then insert it. You send it yourself.</li></ol>
        <a href="https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing" target="_blank" rel="noreferrer">Microsoft installation guide ↗</a>
      </section>
      <section><span className="eyebrow">Google Drive & Docs</span><h2>Choose files to import</h2><p>Pick a Google document, DOCX, PDF or text file. LOCKE copies it into the selected firm's private vault; Google documents are exported as DOCX.</p>
        <p className="connection-status">{googleReady ? 'App configured · each user authorizes their own import' : 'Google app registration required'}</p>
        <Link className="connection-action" href="/?view=vault">Try Google Drive import ↗</Link>
        <p>To test: open the vault, sign in to LOCKE, then select <strong>Import from Google Drive</strong>. Choose your Google account and a document to import.</p><p>Selected-file permission only. This is a one-time copy, not background synchronization. Google access tokens are held in memory and authorization is revoked after import.</p>
        {!googleReady && <details><summary>Platform owner: configure Google once</summary><ol><li>Create a Google Cloud project and enable Google Drive API and Google Picker API.</li><li>Configure the OAuth consent screen for LOCKE. For external apps in testing, add the pilot lawyers as test users.</li><li>Create an OAuth client of type Web application with authorized JavaScript origin <code>https://lockeslaw.sheenax.xyz</code>. This popup token flow needs no redirect URL or client secret.</li><li>Create a browser API key restricted to Google Picker API and Google Drive API. Add referrers <code>https://lockeslaw.sheenax.xyz/*</code> and <code>https://docs.google.com/*</code> for the Picker iframe.</li><li>Add Vercel production variables <code>GOOGLE_DRIVE_CLIENT_ID</code>, <code>GOOGLE_PICKER_API_KEY</code>, and <code>GOOGLE_CLOUD_PROJECT_NUMBER</code> from that project, then redeploy.</li></ol><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Open Google Cloud credentials ↗</a></details>}
      </section>
      <section><span className="eyebrow">Firm rollout</span><h2>One workspace per firm</h2><p>Your LOCKE account manages your firm workspace. Each lawyer joins that workspace with their own LOCKE login and uses their own Microsoft or Google identity.</p><p>For a team rollout, a Microsoft 365 administrator uploads the manifests through Integrated apps in the Microsoft 365 admin centre and assigns the lawyers who may use them. Firm policies may block individual installation or require approval.</p><h3>Passkey window not appearing?</h3><p>Use Microsoft sign-in in your own Chrome or Edge browser. If offered, choose Sign-in options or Other ways to sign in and use a method your account supports. A cloud browser may not have access to your device's passkey. Signing in to Microsoft alone does not install the LOCKE add-in.</p><p>Native Word/Outlook acceptance remains pending until the add-in is exercised inside those applications. Gmail and Google Docs editing are not connected by the Drive import.</p></section>
    </div>
  </main>;
}
