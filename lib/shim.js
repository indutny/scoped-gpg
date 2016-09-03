'use strict';

const fs = require('fs');
const semver = require('semver');

// No shim is required for the newest node.js
if (semver.satisfies(process.version, '>= 5.10.0')) {
  exports.mkdtemp = fs.mkdtemp;
  exports.mkdtempSync = fs.mkdtempSync;
  return;
}

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const rimraf = require('rimraf');

exports.mkdtemp = function mkdtemp(prefix, callback) {
  const dir = prefix + crypto.randomBytes(8).toString('hex');
  fs.exists(dir, (exists) => {
    if (exists)
      return mkdtemp(prefix, callback);

    fs.mkdir(dir, (err) => {
      if (err)
        return callback(err);

      // Clean-up on exit
      process.once('exit', () => {
        try {
          rimraf.sync(dir);
        } catch (e) {
        }
      });

      callback(null, dir);
    });
  });
};

exports.mkdtempSync = function mkdtempSync(prefix) {
  const dir = prefix + crypto.randomBytes(8).toString('hex');

  const exists = fs.existsSync(dir);
  if (exists)
    return mkdtempSync(prefix);

  fs.mkdirSync(dir);

  // Clean-up on exit
  process.once('exit', () => {
    try {
      rimraf.sync(dir);
    } catch (e) {
    }
  });

  return dir;
};
