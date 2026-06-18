const crypto = require('crypto');

/**
 * Hash a record object with SHA-256.
 * Keys are sorted so the hash is deterministic regardless of insertion order.
 *
 * @param {Object} data - The record data to hash
 * @returns {string} 64-char hex digest
 */
function hashRecord(data) {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

/**
 * Verify record integrity by re-hashing and comparing.
 * Uses timingSafeEqual to prevent timing-based attacks.
 *
 * @param {Object} data       - The record data to verify
 * @param {string} storedHash - The hash stored at creation time
 * @returns {boolean}
 */
function verifyRecord(data, storedHash) {
  const computed = hashRecord(data);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Build a chained audit log hash.
 * Each entry includes the previous entry's hash,
 * making any historical modification detectable.
 *
 * @param {Object} entry       - { userId, action, recordId, timestamp }
 * @param {string} previousHash - Hash of the previous audit log entry
 * @returns {string} 64-char hex digest
 */
function buildChainedHash(entry, previousHash) {
  const payload = JSON.stringify({
    userId:       entry.userId,
    action:       entry.action,
    recordId:     entry.recordId || null,
    timestamp:    entry.timestamp,
    previousHash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * General-purpose SHA-256 string hash.
 * @param {string} value
 * @returns {string}
 */
function hashString(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { hashRecord, verifyRecord, buildChainedHash, hashString };
