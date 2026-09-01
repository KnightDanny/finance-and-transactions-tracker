import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { RawEmail } from './types';

// OAuth web client of the budget-tracker Google Cloud project. Client IDs are
// public identifiers (the matching Android client is validated by package name
// + signing SHA-1); no secret ships in the app.
const WEB_CLIENT_ID = '867375684904-j8tjj9uce26k4o21gnoegmv3uihn94ar.apps.googleusercontent.com';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, scopes: [GMAIL_SCOPE] });
  configured = true;
}

/** Interactive sign-in. Returns the connected email address. */
export async function connectGmail(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  const email = result?.data?.user?.email;
  if (!email) throw new Error('Sign-in was cancelled');
  return email;
}

/** Email of the already-signed-in account, or null. Never prompts. */
export async function getConnectedEmail(): Promise<string | null> {
  ensureConfigured();
  try {
    const current = GoogleSignin.getCurrentUser();
    if (current?.user?.email) return current.user.email;
    const silent = await GoogleSignin.signInSilently();
    return silent?.data?.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function disconnectGmail(): Promise<void> {
  ensureConfigured();
  try {
    await GoogleSignin.signOut();
  } catch {}
}

async function accessToken(): Promise<string> {
  ensureConfigured();
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    // atob → binary string; re-interpret as UTF-8
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Depth-first hunt for the best body part: text/plain wins, HTML is fallback. */
function extractBody(payload: any): string {
  let plain = '';
  let html = '';
  const walk = (part: any) => {
    if (!part) return;
    const data = part.body?.data;
    if (data) {
      if (part.mimeType === 'text/plain' && !plain) plain = decodeBase64Url(data);
      else if (part.mimeType === 'text/html' && !html) html = decodeBase64Url(data);
    }
    (part.parts ?? []).forEach(walk);
  };
  walk(payload);
  return plain || stripHtml(html);
}

function header(payload: any, name: string): string {
  return payload?.headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

/**
 * Fetch emails matching a Gmail search query (e.g. "from:(a OR b) after:123"),
 * newest capped at `max`. Requires a connected account.
 */
export async function fetchEmails(query: string, max: number = 100): Promise<RawEmail[]> {
  const token = await accessToken();
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const listRes = await fetch(
    `${API}/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
    auth
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);
  const list = await listRes.json();
  const ids: { id: string }[] = list.messages ?? [];

  const out: RawEmail[] = [];
  for (const { id } of ids) {
    const msgRes = await fetch(`${API}/messages/${id}?format=full`, auth);
    if (!msgRes.ok) continue;
    const msg = await msgRes.json();
    out.push({
      id,
      from: header(msg.payload, 'From'),
      subject: header(msg.payload, 'Subject'),
      body: extractBody(msg.payload),
      internalDate: parseInt(msg.internalDate ?? '0', 10),
    });
  }
  return out;
}

export { statusCodes };
