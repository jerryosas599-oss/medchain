import * as crypto from 'crypto';

// Derive a 32-byte key from environment or JWT secret for compatibility.
const KEY = process.env.RECORD_MASTER_KEY
  ? Buffer.from(process.env.RECORD_MASTER_KEY, 'hex')
  : crypto.createHash('sha256').update(process.env.JWT_SECRET || 'dev_record_key').digest();

function encryptRecord(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const plaintext = JSON.stringify(obj, Object.keys(obj).sort());
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: encrypted };
}

function decryptRecord(enc) {
  if (!enc || !enc.iv || !enc.tag || !enc.data) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(enc.iv, 'base64');
  const tag = Buffer.from(enc.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(enc.data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

export { encryptRecord, decryptRecord };
