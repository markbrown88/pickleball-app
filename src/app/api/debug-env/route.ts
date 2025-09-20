import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  
  return NextResponse.json({
    hasDatabaseUrl: !!dbUrl,
    databaseUrlLength: dbUrl?.length || 0,
    databaseUrlStart: dbUrl?.substring(0, 20) || 'undefined',
    databaseUrlEnd: dbUrl?.substring(dbUrl.length - 20) || 'undefined',
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('DATABASE') || key.includes('DB'))
  });
}
