import { NextRequest, NextResponse } from 'next/server';
import { flushAllBuffers, getBufferSize } from '@/lib/writeBuffer';

export async function GET(req: NextRequest) {
  // Vercel Cron Jobからの呼び出しを検証
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bufferSize = await getBufferSize();
    const result = await flushAllBuffers();

    return NextResponse.json({
      success: true,
      bufferSizeBefore: bufferSize,
      flushed: result.flushed,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Flush buffer cron error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
