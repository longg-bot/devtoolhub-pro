import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get('auth_token')?.value;
  const isLoggedIn = token ? await verifyToken(token) : false;

  return NextResponse.json({ isLoggedIn });
} 