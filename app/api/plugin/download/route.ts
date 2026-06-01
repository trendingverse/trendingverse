import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// This route serves the latest plugin zip file
// Store the zip in /public/downloads/ in your repo
export async function GET(req: NextRequest) {
  try {
    const zipPath = path.join(process.cwd(), 'public', 'downloads', 'trendingverse-ads.zip')
    
    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: 'Plugin file not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(zipPath)
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="trendingverse-ads.zip"',
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
