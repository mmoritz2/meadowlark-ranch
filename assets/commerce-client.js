// Paid entitlements stay in memory and are refreshed from the account service.
// No local save, gift code, or imported ranch can credit this wallet.
export const isStaticStore = location.hostname === 'github.io' || location.hostname.endsWith('.github.io');
let account = null;
let verifiedAt = 0;
const API = new URL('../api/', import.meta.url);
export async function api(path, body, timeout = 20000) {
  if (isStaticStore) throw Object.assign(Error('Purchases and ranch accounts are not available in this store preview.'), {status: 503});
  const response = await fetch(new URL(path, API), {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? {} : {'Content-Type': 'application/json'},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(timeout),
  });
  let data;
  try {data = await response.json();} catch {throw Error('The account service is not available on this version of the game.');}
  if (!response.ok) throw Object.assign(Error(data.error || 'Please try again.'), {status: response.status});
  return data;
}
export async function refreshAccount() {
  if (isStaticStore) {account = null; verifiedAt = 0; return null;}
  try {account = await api('me', undefined, 4000); verifiedAt = Date.now();}
  catch {account = null; verifiedAt = 0;}
  return account;
}
export function paidVipUntil() {
  // Require periodic online verification; never turn the response into a durable save flag.
  return account && Date.now() - verifiedAt < 120000 && !account.wallet.held ? account.wallet.vipUntil : 0;
}
export function currentAccount() {return account;}
