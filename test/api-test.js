'use strict';

const fs = require('fs');
const path = require('path');

const async = require('async');
const tape = require('tape');

const ScopedGPG = require('../');

const fixtures = path.join(__dirname, 'fixtures');
const messages = path.join(fixtures, 'messages');
const keyring = path.join(fixtures, 'tmp', 'keyring1');

function loadMessage(name) {
  return {
    payload: fs.readFileSync(path.join(messages, name)),
    signature: fs.readFileSync(path.join(messages, name + '.sig'))
  };
}

tape('scoped-gpg .verify()', (t) => {
  try {
    fs.unlinkSync(keyring);
  } catch (e) {
  }

  const confirmed = [];

  const gpg = new ScopedGPG({
    keyring: keyring,
    confirm: (key, callback) => {
      confirmed.push(key);
      callback(null, true);
    }
  });

  async.waterfall([
    (callback) => {
      const msg =  loadMessage('1');
      gpg.verify(msg.payload, msg.signature, callback);
    }
  ], (err) => {
    try {
      fs.unlinkSync(keyring);
    } catch (e) {
    }
    t.deepEqual(confirmed, [ '96E07AF25771955980DAD10020D04E5A713660A7' ],
                'should not ask for more than 1 key');
    t.end(err);
  });
});
