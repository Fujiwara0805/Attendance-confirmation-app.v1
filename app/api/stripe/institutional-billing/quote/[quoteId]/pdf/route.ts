import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const quote = await stripe.quotes.retrieve(params.quoteId);
    if (quote.metadata?.userId !== session.user.email) {
      return NextResponse.json({ error: 'アクセスできません' }, { status: 403 });
    }

    const pdfStream = await stripe.quotes.pdf(params.quoteId);
    const chunks: Buffer[] = [];

    for await (const chunk of pdfStream as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return new NextResponse(Buffer.concat(chunks), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${params.quoteId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Quote PDF fetch error:', error);
    return NextResponse.json({ error: '見積書PDFを取得できませんでした' }, { status: 500 });
  }
}
