#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoPath = __dirname;
const gitDir = path.join(repoPath, '.git');

function isGitRepo() {
  return fs.existsSync(gitDir) && fs.lstatSync(gitDir).isDirectory();
}

function getRemoteUrl() {
  try {
    return execSync('git remote get-url origin', { cwd: repoPath, stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch (error) {
    return null;
  }
}

function pullLatest(remote) {
  try {
    const output = execSync('git pull --ff-only', { cwd: repoPath, stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
    console.log(`Updated from ${remote}.`);
    console.log(output || 'Already up to date.');
    return true;
  } catch (error) {
    const stdout = error.stdout?.toString().trim();
    const stderr = error.stderr?.toString().trim();
    console.error('Failed to update this repository.');
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    console.error('Check your git credentials or resolve any conflicts, then try again.');
    return false;
  }
}

function main() {
  if (!isGitRepo()) {
    console.error('This folder is not a git repository. Initialize git and configure a GitHub remote before running Update.');
    process.exit(1);
  }

  const remote = getRemoteUrl();
  if (!remote) {
    console.error('No git remote named "origin" is configured. Add your GitHub remote (e.g., "git remote add origin <url>") and try again.');
    process.exit(1);
  }

  console.log(`Fetching updates from ${remote}...`);
  const ok = pullLatest(remote);
  process.exit(ok ? 0 : 1);
}

main();
