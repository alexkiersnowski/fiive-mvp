#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Dashboard pages to precompile
const dashboardPages = [
  '/home',
  '/tasks', 
  '/requests',
  '/connected'
];

console.log('🚀 Precompiling dashboard pages...');

// Check if dev server is running
const isDevServerRunning = () => {
  try {
    execSync('curl -s http://localhost:3000 > /dev/null', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

// Wait for dev server to be ready
const waitForDevServer = (maxAttempts = 30) => {
  for (let i = 0; i < maxAttempts; i++) {
    if (isDevServerRunning()) {
      console.log('✅ Dev server is ready');
      return true;
    }
    console.log(`⏳ Waiting for dev server... (${i + 1}/${maxAttempts})`);
    execSync('sleep 1');
  }
  return false;
};

// Precompile a page
const precompilePage = (page) => {
  try {
    console.log(`📄 Precompiling ${page}...`);
    execSync(`curl -s http://localhost:3000${page} > /dev/null`, { stdio: 'pipe' });
    console.log(`✅ ${page} precompiled`);
  } catch (error) {
    console.log(`❌ Failed to precompile ${page}: ${error.message}`);
  }
};

// Main execution
const main = async () => {
  if (!waitForDevServer()) {
    console.log('❌ Dev server not available');
    process.exit(1);
  }

  // Precompile all dashboard pages
  dashboardPages.forEach(precompilePage);
  
  console.log('🎉 Dashboard precompilation complete!');
};

main().catch(console.error);
