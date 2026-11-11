import {createHmac,timingSafeEqual} from 'node:crypto';

export function verifySnippeSignature(body: string, timestamp: string, signature: string, secret: string, now = Date.now()) {
  if (!secret || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(timestamp + '.' + body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export const starterPrice = 49_000;
