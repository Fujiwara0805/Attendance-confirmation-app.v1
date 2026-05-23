import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value?: string | number | null) {
  if (!value) return '';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return date.toLocaleDateString('ja-JP');
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const invoiceId = request.nextUrl.searchParams.get('invoice');
    if (!invoiceId) {
      return NextResponse.json({ error: '請求書IDが必要です' }, { status: 400 });
    }

    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ['customer'],
    });

    if (invoice.metadata?.userId !== session.user.email) {
      return NextResponse.json({ error: 'アクセスできません' }, { status: 403 });
    }

    const customer = invoice.customer as Stripe.Customer | null;
    const metadata = invoice.metadata || {};
    const institutionName = metadata.institutionName || customer?.name || '';
    const departmentName = metadata.departmentName || '';
    const contactName = metadata.contactName || '';
    const planName = metadata.productType === 'enterprise_subscription'
      ? 'ざせきくん Enterprise プラン'
      : 'ざせきくん Pro プラン';
    const periodStart = formatDate(metadata.periodStart);
    const periodEnd = formatDate(metadata.periodEnd);
    const amount = invoice.amount_due.toLocaleString('ja-JP');
    const issuedAt = formatDate(invoice.created);
    const invoiceIdentifier = invoice.number || invoice.id || invoiceId;

    const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>納品書 ${escapeHtml(invoiceIdentifier)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; margin: 0; background: #f8fafc; }
    .sheet { width: 794px; min-height: 1123px; margin: 24px auto; padding: 56px; background: #fff; box-sizing: border-box; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08); }
    h1 { text-align: center; font-size: 28px; letter-spacing: 0.12em; margin: 0 0 40px; }
    .meta { text-align: right; font-size: 13px; line-height: 1.8; color: #475569; }
    .recipient { margin-top: 32px; font-size: 18px; line-height: 1.8; }
    .message { margin-top: 36px; line-height: 1.9; font-size: 14px; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-top: 32px; font-size: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; }
    .issuer { margin-top: 48px; margin-left: auto; width: 280px; font-size: 13px; line-height: 1.8; color: #334155; }
    .actions { width: 794px; margin: 16px auto; text-align: right; }
    button { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
    @media print {
      body { background: #fff; }
      .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">印刷 / PDF保存</button></div>
  <main class="sheet">
    <h1>納品書</h1>
    <div class="meta">
      発行日: ${escapeHtml(issuedAt)}<br />
      関連請求書: ${escapeHtml(invoiceIdentifier)}
    </div>
    <section class="recipient">
      ${escapeHtml(institutionName)} 御中<br />
      ${departmentName ? `${escapeHtml(departmentName)}<br />` : ''}
      ${contactName ? `${escapeHtml(contactName)} 様` : ''}
    </section>
    <p class="message">
      下記の通り、クラウドサービス利用権を納品いたしました。
    </p>
    <table>
      <thead>
        <tr>
          <th>品名</th>
          <th>利用期間</th>
          <th>数量</th>
          <th class="amount">金額（税込）</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(planName)}</td>
          <td>${escapeHtml(periodStart)} - ${escapeHtml(periodEnd)}</td>
          <td>1</td>
          <td class="amount">¥${escapeHtml(amount)}</td>
        </tr>
      </tbody>
    </table>
    <section class="issuer">
      発行者<br />
      ざせきくん<br />
      お問い合わせ: sobota@nobody-info.com
    </section>
  </main>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Delivery note render error:', error);
    return NextResponse.json({ error: '納品書を作成できませんでした' }, { status: 500 });
  }
}
