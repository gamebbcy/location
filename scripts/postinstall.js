#!/usr/bin/env node
const { execSync } = require('child_process');

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.warn(`Skipping: ${cmd}`);
  }
}

run('fullstack-cli action-plugin init');
run('git config core.hooksPath .githooks');
