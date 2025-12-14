#!/usr/bin/env node

/**
 * Node.js script to run the inactivity check
 * Useful for testing or running from external cron services
 * 
 * Usage:
 *   node scripts/run-inactivity-check.js
 * 
 * Or make it executable and run directly:
 *   chmod +x scripts/run-inactivity-check.js
 *   ./scripts/run-inactivity-check.js
 */

// Load environment variables from .env.local
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed, try to load from environment directly
  console.log('Note: dotenv package not found, using environment variables directly');
  console.log('  Install dotenv: npm install --save-dev dotenv');
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

async function checkServerHealth() {
  try {
    const healthUrl = `${API_URL}/api/health`;
    const response = await fetch(healthUrl, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function runInactivityCheck() {
  const url = `${API_URL}/api/nominee/access/check-inactivity`;
  const headers = {
    'Content-Type': 'application/json',
  };

  console.log(`Connecting to: ${url}`);
  console.log('');

  // Check if server is running (only for localhost)
  if (API_URL.includes('localhost') || API_URL.includes('127.0.0.1')) {
    console.log('Checking if server is running...');
    const isServerRunning = await checkServerHealth();
    if (!isServerRunning) {
      console.error('✗ Error: Next.js server is not running');
      console.error('');
      console.error('  To start the server, run:');
      console.error('    npm run dev');
      console.error('');
      console.error('  Then run this script again in another terminal.');
      process.exit(1);
    }
    console.log('✓ Server is running');
    console.log('');
  }

  if (CRON_SECRET) {
    headers['Authorization'] = `Bearer ${CRON_SECRET}`;
    console.log('Running inactivity check with authentication...');
  } else {
    console.log('Running inactivity check without authentication (CRON_SECRET not set)...');
  }
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✓ Inactivity check completed successfully');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('✗ Inactivity check failed');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch failed') || error.cause?.code === 'ECONNREFUSED') {
      console.error('✗ Error: Could not connect to the API server');
      console.error('');
      if (API_URL.includes('localhost') || API_URL.includes('127.0.0.1')) {
        console.error('  The Next.js dev server is not running.');
        console.error('  Start it with: npm run dev');
        console.error('  Then run this script again in another terminal.');
      } else {
        console.error(`  Could not reach: ${API_URL}`);
        console.error('  Please verify:');
        console.error('    - The server is running and accessible');
        console.error('    - The URL is correct');
        console.error('    - Network connectivity is available');
      }
    } else {
      console.error('✗ Error running inactivity check:', error.message);
      if (error.stack) {
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
      }
    }
    process.exit(1);
  }
}

runInactivityCheck();

