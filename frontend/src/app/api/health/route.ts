import { NextResponse } from 'next/server';

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

