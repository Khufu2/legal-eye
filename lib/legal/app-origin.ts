/** Canonical destination for account email links and links shared with clients. */
export const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.lockeslaw.xyz').replace(/\/+$/, '');
