/**
 * Helpers for explaining server start-up failures (e.g. the Firebase Admin SDK failing to
 * load) in words an administrator can act on — instead of an empty "500".
 */

/** firebase-admin 14 and its Google Cloud dependencies require Node.js 22 or newer. */
export const MIN_NODE_MAJOR = 22;

export function nodeVersionInfo() {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  return {
    version: process.version,
    major,
    minor,
    supported: major >= MIN_NODE_MAJOR,
    /** e.g. "AWS_Lambda_nodejs18.x" on Netlify Functions — shows which runtime is pinned. */
    platform: process.env.AWS_EXECUTION_ENV || null,
  };
}

/** Error code / name plus a short first line, with anything that looks like key material removed. */
export function safeErrorSummary(err: unknown): string {
  const e = err as { code?: unknown; name?: unknown; message?: unknown };
  const code = typeof e?.code === 'string' ? e.code : typeof e?.name === 'string' ? e.name : 'Error';
  const firstLine = String(e?.message ?? err).split('\n')[0];
  const redacted = firstLine
    .replace(/-----BEGIN[\s\S]*?(-----END[^-]*-----|$)/g, '[redacted key]')
    .replace(/[A-Za-z0-9+/=_-]{40,}/g, '[redacted]')
    .slice(0, 240);
  return `${code}: ${redacted}`;
}

/** What to tell people when the Admin SDK module itself could not be loaded. */
export function describeStartupError(err: unknown): string {
  const node = nodeVersionInfo();
  if (!node.supported) {
    return (
      `The server is running Node.js ${node.version}, but sign-in needs Node.js ${MIN_NODE_MAJOR} or newer. ` +
      'An administrator needs to open Netlify → Site configuration → Environment variables, delete ' +
      `AWS_LAMBDA_JS_RUNTIME (or set it to nodejs${MIN_NODE_MAJOR}.x), and redeploy.`
    );
  }
  return `The server could not start its Firebase connection (${safeErrorSummary(err)}). An administrator should check the server logs.`;
}
