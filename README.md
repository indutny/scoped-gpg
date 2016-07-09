# scoped-gpg
[![NPM version](https://badge.fury.io/js/scoped-gpg.svg)](http://badge.fury.io/js/scoped-gpg)
[![Build Status](https://secure.travis-ci.org/indutny/scoped-gpg.svg)](http://travis-ci.org/indutny/scoped-gpg)

## Why?

`gpg` isn't really fancy when it comes to verifying software releases. Usually
each OSS project teams share a list of GPG keys, and they should be used to
verify release signatures of **only** that particular project.

However, default behavior is to add everything to `default-keyring`, and it is
pretty inconvenient to work with a custom keyring.

## How?

`scoped-gpg` explicitly works only with a specified keyring, additionally if the
key for the signature is missing - it will ask the user about adding it to the
custom keyring.

`scoped-gpg` may be used with `git tag -v`, just set:
`git config gpg.program "scoped-gpg"`

And optionally: `git config gpg.scope "file-name"` (default value is
`gpg-scope`).

## Installation

```bash
npm install -g scoped-gpg
```

## Usage

```bash
scoped-gpg --list-keys --keyring /path/to/keyring
scoped-gpg --keyring /path/to/keyring --verify signature < message
```

## LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2016.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
