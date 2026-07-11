import dns from 'node:dns/promises';

export function safeError(message) {
  const err = new Error(message);
  err.__safeForClient = true;
  return err;
}

export function toClientError(error) {
  console.error(error);
  if (error && error.__safeForClient) {
    return error.message;
  }
  return 'The request could not be completed. Check your connection string and try again.';
}

// Relaxed identifier validation: allows anything except double-quotes 
// and null bytes, relying on strict double-quoting in the SQL builder.
const INVALID_IDENTIFIER_RE = /["\0]/;

export function assertValidIdentifier(name, kind) {
  if (typeof name !== 'string' || !name.trim() || INVALID_IDENTIFIER_RE.test(name)) {
    throw safeError(`Invalid ${kind} name: cannot contain double-quotes or null bytes.`);
  }
}

// Updated to prep for MySQL support
export function assertLooksLikeDbUri(connectionString) {
  if (
    typeof connectionString !== 'string' ||
    !/^(postgres(ql)?|mysql):\/\//i.test(connectionString)
  ) {
    throw safeError('A valid Postgres or MySQL connection string is required.');
  }
}

const BLOCKED_V4_RANGES = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isBlockedV4(ip) {
  const target = ipv4ToInt(ip);
  return BLOCKED_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedV6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  return false;
}

export async function assertPublicHost(connectionString) {
  let hostname;
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    throw safeError('Malformed connection string.');
  }

  if (!hostname) throw safeError('Connection string is missing a host.');
  if (hostname.toLowerCase() === 'localhost') {
    throw safeError('Connections to localhost are not allowed.');
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw safeError('Could not resolve database host.');
  }

  for (const { address, family } of addresses) {
    const blocked = family === 4 ? isBlockedV4(address) : isBlockedV6(address);
    if (blocked) {
      throw safeError('Connections to private or internal network addresses are not allowed.');
    }
  }
}

export function assertBodyWithinLimit(request, maxBytes) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) {
    throw safeError(`Request body too large (max ${Math.floor(maxBytes / 1024)}KB).`);
  }
}