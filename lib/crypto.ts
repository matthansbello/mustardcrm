import crypto from 'crypto';

const IV_LENGTH = 16;

function getEncryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY is required in production');
    }
    // Dev-only fallback — never use in production
    return 'mustard_dev_only_encryption_key!!';
  }
  if (key.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters');
  }
  return key;
}

/**
 * Encrypts sensitive string data (e.g. Google OAuth tokens).
 * Format: ivHex:ciphertextHex (AES-256-GCM-compatible CBC with random IV).
 */
export function encryptToken(text: string): string {
  const key = crypto.scryptSync(getEncryptionKey(), 'mustard-token-salt-v1', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts encrypted token string (used by server/Cloud Functions).
 */
export function decryptToken(encryptedText: string): string {
  if (encryptedText.startsWith('b64:')) {
    // Legacy/dev fallback — migrate away from these
    return Buffer.from(encryptedText.slice(4), 'base64').toString('utf8');
  }

  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }

  const key = crypto.scryptSync(getEncryptionKey(), 'mustard-token-salt-v1', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
