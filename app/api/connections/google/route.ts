export function GET() {
  // Public Google web-client configuration. No client secret or provider token is exposed.
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
  const apiKey = process.env.GOOGLE_PICKER_API_KEY || '';
  const appId = process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '';
  const configured = Boolean(clientId && apiKey && appId);
  return Response.json({configured, ...(configured ? {clientId, apiKey, appId} : {})}, {headers: {'cache-control': 'no-store'}});
}
