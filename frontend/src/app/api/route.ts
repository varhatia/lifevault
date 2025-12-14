import { NextResponse } from 'next/server';

/**
 * @route   GET /api
 * @desc    API information endpoint
 * @access  Public
 */
export async function GET() {
  return NextResponse.json({
    name: 'LifeVault API',
    version: '0.1.0',
    description: 'Zero-knowledge encrypted vault API',
    endpoints: {
      health: '/api/health',
      vaults: '/api/vaults/my',
      family: '/api/family/vaults',
      nominee: '/api/nominee',
      reminders: '/api/reminders',
    },
  });
}

