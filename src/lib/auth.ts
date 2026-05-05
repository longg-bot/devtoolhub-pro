// Simple JWT implementation using Web Crypto API (compatible with Edge + Node.js)
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = str.length % 4 ? 4 - (str.length % 4) : 0;
  str += "=".repeat(padding);
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createSignature(header: string, payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = encoder.encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return base64UrlEncode(signature);
}

export async function verifyToken(token: string): Promise<boolean> {
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
  const DOMAIN = process.env.DOMAIN || "localhost";
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const header = JSON.parse(decoder.decode(base64UrlDecode(parts[0])));
    const payload = JSON.parse(decoder.decode(base64UrlDecode(parts[1])));
    const expectedSig = await createSignature(parts[0], parts[1], JWT_SECRET);

    if (parts[2] !== expectedSig) return false;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;

    if (process.env.NODE_ENV === "development") {
      return payload && (payload.domain === "localhost" || payload.domain === "127.0.0.1");
    }
    return payload.domain === DOMAIN;
  } catch {
    return false;
  }
}

export async function createToken(): Promise<string> {
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
  const DOMAIN = process.env.DOMAIN || "localhost";
  const headerBytes = encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const header = base64UrlEncode(headerBytes.buffer as ArrayBuffer);
  const payloadBytes = encoder.encode(
    JSON.stringify({
      authenticated: true,
      domain: DOMAIN,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  );
  const payload = base64UrlEncode(payloadBytes.buffer as ArrayBuffer);
  const signature = await createSignature(header, payload, JWT_SECRET);
  return `${header}.${payload}.${signature}`;
}
