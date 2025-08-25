import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({
    hasDb: !!process.env.DATABASE_URL,
    hasDirect: !!process.env.DIRECT_URL,
    hasClerkPub: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    hasClerkSec: !!process.env.CLERK_SECRET_KEY,
  });
}
