'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Read the store file and return parsed JSON object.
 * Returns {} if file doesn't exist (CONSTRAINT-003: lazy creation).
 *
 * @param {string} filePath - Path to the JSON store file
 * @returns {Object} The parsed store contents, or {} if file missing
 */
function readStore(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

/**
 * Write data to the store file using lockfile (O_EXCL) for mutual exclusion
 * and atomic rename for crash safety (CONSTRAINT-001).
 *
 * Flow: acquire lock → write temp → rename temp to target → release lock
 *
 * @param {string} filePath - Path to the JSON store file
 * @param {Object} data - The data object to write
 */
function writeStore(filePath, data) {
  const dir = path.dirname(filePath);
  const lockPath = filePath + '.lock';
  const tempPath = filePath + '.tmp';

  // Ensure directory exists for first write
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let lockFd;
  try {
    // Acquire lockfile via O_EXCL — fails if lock already exists
    lockFd = fs.openSync(lockPath, 'wx');
  } catch (err) {
    if (err.code === 'EEXIST') {
      throw new Error(
        'Store is locked by another process. If no other process is running, ' +
        'remove the lock file: ' + lockPath
      );
    }
    throw err;
  }

  try {
    // Write to temp file first (crash safety — original untouched until rename)
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

    // Atomic rename: temp → target
    fs.renameSync(tempPath, filePath);
  } finally {
    // Release lock: close fd then remove lockfile
    fs.closeSync(lockFd);
    try {
      fs.unlinkSync(lockPath);
    } catch (_) {
      // Lock file may already be gone — ignore
    }

    // Clean up temp file if rename failed
    try {
      fs.unlinkSync(tempPath);
    } catch (_) {
      // Temp file may already be renamed — ignore
    }
  }
}

module.exports = { readStore, writeStore };
