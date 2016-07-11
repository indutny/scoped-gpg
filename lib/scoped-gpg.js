'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const spawn = require('child_process').spawn;

const async = require('async');
const reopenTTY = require('reopen-tty');

const GPG = process.env.GPG || 'gpg';

function ScopedGPG(options) {
  this.options = options || {};
  if (!this.options.keyring)
    throw new Error(`keyring is a required option`);

  this.keyring = this.options.keyring;
}
module.exports = ScopedGPG;

// For CLI
ScopedGPG.GPG = GPG;

function buffer(stream) {
  let chunks = '';
  let done = false;

  stream.on('data', chunk => chunks += chunk);
  stream.on('end', () => done = true);

  return (callback) => {
    if (done)
      return callback(null, chunks);
    else
      stream.once('end', () => callback(null, chunks));
  };
}

function bufferFile(file) {
  return (callback) => {
    fs.exists(file, (exists) => {
      if (!exists)
        return callback(null, '');

      fs.readFile(file, (err, content) => {
        if (err)
          return callback(err);
        callback(null, content.toString());
      });
    });
  };
}

function gpg(args, stdio, keyring, callback) {
  // TODO(indutny): status file on Windows
  const pre = [ '--no-default-keyring', '--keyring', keyring, '--status-fd=3' ];

  // `--status-fd=3` does not work to well on windows
  let statusFile;
  if (process.platform === 'win32') {
    statusFile = path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), 'scoped-gpg-')),
        'gpg-status');
    pre[3] = `--status-file=${statusFile}`;
  }
  const p = spawn(GPG, pre.concat(args), { stdio: stdio });

  const stdout = p.stdout ? buffer(p.stdout) : (cb) => cb(null, null);
  const stderr = p.stderr ? buffer(p.stderr) : (cb) => cb(null, null);
  const status = process.platform === 'win32' ?
      bufferFile(statusFile) :
      p.stdio[3] ? buffer(p.stdio[3]) : (cb) => cb(null, null);

  async.parallel({
    code: (callback) => {
      p.on('exit', (status) => callback(null, status));
    },
    stdout: stdout,
    stderr: stderr,
    status: status
  }, callback);

  return p.stdin;
};

function TTYPair(input, output) {
  this.stdin = input;
  this.stderr = output;
}

TTYPair.prototype.destroy = function destroy() {
  if (this.stdin === process.stdin)
    return;
  this.stdin.destroy();
  this.stderr.destroy();
};

function getTTY(callback) {
  if (process.stdin.isTTY)
    return callback(null, new TTYPair(process.stdin, process.stderr));

  async.parallel({
    stdin: callback => reopenTTY.stdin(callback),
    stderr: callback => reopenTTY.stderr(callback)
  }, (err, res) => {
    if (err)
      return callback(err);

    callback(null, new TTYPair(res.stdin, res.stderr));
  });
}

const IMPORT_RE =
    /(?:^|\r\n|\n)\[GNUPG:\] (IMPORT_OK|IMPORT_PROBLEM) (.*)(?:$|\r\n|\n)/;

ScopedGPG.prototype.promptPubkey = function promptPubkey(id, callback) {
  async.waterfall([
    // Create temporary keyring
    callback => fs.mkdtemp(path.join(os.tmpdir(), 'scoped-gpg-'), callback),
    (tmp, callback) => {
      tmp = path.join(tmp, 'keyring');
      callback(null, tmp);
    },
    (keyring, callback) => {
      const stdio = [ null, 'pipe', 'pipe', 'pipe' ];
      const args = [ '--recv-keys', id ];
      if (this.options.keyserver)
        args.unshift('--keyserver', this.options.keyserver);

      const stdin = gpg(args, stdio, keyring, callback);
    },
    (results, callback) => {
      getTTY((err, tty) => callback(err, results, tty));
    },
    (results, tty, callback) => {
      const pubkey = results.status.match(IMPORT_RE);
      if (pubkey === null || pubkey[1] === 'IMPORT_PROBLEM') {
        callback(new Error(`gpg failed: ${results.stdout}\n${results.stderr}`));
        return;
      }

      let msg = (results.stdout + results.stderr).split(/\r\n|\n/g);
      msg = msg.filter((line) => {
        return !/^gpg: keyring.*created$/.test(line) && line;
      });
      msg.push(`gpg exit code ${results.code}`);

      // Mostly for testing
      if (this.options.confirm) {
        tty.destroy();
        return this.options.confirm(pubkey[2].split(' ')[1], (err, result) => {
          callback(err, result);
        });
      }

      tty.stderr.write(msg.join('\n') + '\n');

      const challenge = id.slice(0, 6);

      const rl = readline.createInterface({
        input: tty.stdin,
        output: tty.stderr
      });

      function done(err, result) {
        rl.once('close', () => tty.destroy());
        rl.close();
        callback(err, result);
      }

      rl.setPrompt(`Enter key id (${challenge}) to add this ` +
                   `key to "${this.keyring}": `);
      rl.prompt();
      rl.on('line', (line) => {
        done(null, line.toLowerCase() === challenge.toLowerCase(), tty);
      });
      rl.on('error', (err) => done(err));
      rl.on('SIGINT', (err) => done(new Error('canceled')));
    },
    (confirm, callback) => {
      if (!confirm)
        return callback(new Error('gpg key import canceled'));

      callback(null);
    },
    (callback) => {
      const stdio = [ null, 'pipe', 'pipe', 'pipe' ];
      const args = [ '--recv-keys', id ];
      if (this.options.keyserver)
        args.unshift('--keyserver', this.options.keyserver);

      const stdin = gpg(args, stdio, this.keyring, callback);
    },
    (results, callback) => {
      const pubkey = results.status.match(IMPORT_RE);
      if (pubkey === null || pubkey[1] === 'IMPORT_PROBLEM')
        callback(new Error(`gpg failed: ${results.stdout}\n${results.stderr}`));
      else
        callback(null);
    }
  ], callback);
};

const PUBKEY_RE = /(?:^|\r\n|\n)\[GNUPG:\] NO_PUBKEY (.*)(?:$|\r\n|\n)/;

ScopedGPG.prototype.verify = function verify(payload, signature, options,
                                             callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  async.waterfall([
    callback => fs.mkdtemp(path.join(os.tmpdir(), 'scoped-gpg-'), callback),
    (tmp, callback) => {
      tmp = path.join(tmp, 'sig');
      fs.writeFile(tmp, signature, err => callback(err, tmp));
    },
    (signature, callback) => {
      const stdio = [ 'pipe', 'pipe', 'pipe', 'pipe' ];
      const args = [ '--verify', signature, '-' ];
      const stdin = gpg(args, stdio, this.keyring, callback);
      stdin.end(payload);
    },
    (results, callback) => {
      const pubkey = results.status.match(PUBKEY_RE);

      if (pubkey !== null) {
        this.promptPubkey(pubkey[1], (err) => {
          if (err)
            return callback(err);

          // Restart
          this.verify(payload, signature, options, callback);
        });
        return;
      }

      if (options.verbose) {
        process.stdout.write(results.stdout);
        process.stderr.write(results.stderr);

        // git adds `--status-fd=1`
        if (options['status-fd'] === 1)
          process.stdout.write(results.status);
        if (options['status-fd'] === 2)
          process.stderr.write(results.status);
      }

      if (results.code !== 0)
        callback(new Error(`gpg failed: ${results.stdout}\n${results.stderr}`));
      else
        callback(null, true);
    }
  ], callback);
};

ScopedGPG.prototype.listKeys = function listKeys(callback) {
  const stdio = [ null, 'pipe', 'pipe', 'pipe' ];
  const args = [ '--list-keys' ];
  gpg(args, stdio, this.keyring, (err, results) => {
    if (err)
      return callback(err);

    if (results.code !== 0)
      callback(new Error(`gpg failed: ${results.stdout}\n${results.stderr}`));
    else
      callback(null, results.stdout);
  });
};
