#!/usr/bin/env node
// Run HTTP tests and capture exit code
const { exec } = require('child_process');

exec(
  'node --env-file=.env.test --test test/e2e/incoming-nfe.e2e.test.js',
  { cwd: process.cwd() },
  (error, stdout, stderr) => {
    console.log(stdout);
    console.error(stderr);
    if (error) {
      console.error('HTTP_EXIT_CODE=1');
      process.exit(1);
    }
    console.log('HTTP_EXIT_CODE=0');
    process.exit(0);
  }
);
