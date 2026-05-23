import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const PLAN_PRICES = {
  pro: {
    productType: 'pro_subscription',
    plan: 'paid',
    name: 'ざせきくん Pro プラン',
    monthlyAmount: 550,
  },
  enterprise: {
    productType: 'enterprise_subscription',
    plan: 'enterprise',
    name: 'ざせきくん Enterprise プラン',
    monthlyAmount: 2000,
  },
} as const;

const requestSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  termMonths: z.coerce.number().int().min(1).max(12),
  institutionName: z.string().trim().min(1).max(120),
  departmentName: z.string().trim().max(120).optional().default(''),
  contactName: z.string().trim().min(1).max(80),
  billingEmail: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().default(''),
  postalCode: z.string().trim().max(20).optional().default(''),
  address: z.string().trim().min(1).max(240),
  taxId: z.string().trim().max(80).optional().default(''),
  purchaseOrderNumber: z.string().trim().max(80).optional().default(''),
  daysUntilDue: z.coerce.number().int().min(7).max(60).optional().default(30),
  notes: z.string().trim().max(1000).optional().default(''),
});

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toUnix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function getAppUrl(request: NextRequest) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

async function getOrCreateInstitutionalProduct() {
  if (process.env.STRIPE_INSTITUTIONAL_PRODUCT_ID) {
    return process.env.STRIPE_INSTITUTIONAL_PRODUCT_ID;
  }

  const productId = 'prod_zaseki_kun_institutional';
  try {
    const product = await stripe.products.retrieve(productId);
    if (!('deleted' in product && product.deleted)) {
      return product.id;
    }
  } catch (error) {
    const stripeError = error as Stripe.StripeRawError;
    if (stripeError.statusCode !== 404) {
      throw error;
    }
  }

  const product = await stripe.products.create({
    id: productId,
    name: 'ざせきくん 請求書払い',
    description: '教育機関・法人向けの後払い請求書払い（銀行振込）',
    metadata: {
      service: 'zaseki_kun',
      billing_flow: 'institutional_billing',
    },
  });

  return product.id;
}

async function getOrCreateCustomer(input: z.infer<typeof requestSchema>, userEmail: string) {
  const customers = await stripe.customers.list({
    email: input.billingEmail,
    limit: 1,
  });

  const customerData: Stripe.CustomerUpdateParams = {
    name: input.institutionName,
    email: input.billingEmail,
    phone: input.phone || undefined,
    address: {
      country: 'JP',
      postal_code: input.postalCode || undefined,
      line1: input.address,
    },
    metadata: {
      service: 'zaseki_kun',
      requested_by: userEmail,
      institution_name: input.institutionName,
      department_name: input.departmentName,
      contact_name: input.contactName,
      tax_id_text: input.taxId,
    },
  };

  if (customers.data[0]) {
    return stripe.customers.update(customers.data[0].id, customerData);
  }

  return stripe.customers.create(customerData as Stripe.CustomerCreateParams);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const input = requestSchema.parse(await request.json());
    const plan = PLAN_PRICES[input.plan];
    const productId = await getOrCreateInstitutionalProduct();
    const customer = await getOrCreateCustomer(input, session.user.email);
    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, input.termMonths);
    const amount = plan.monthlyAmount * input.termMonths;
    const periodLabel = `${periodStart.toLocaleDateString('ja-JP')} - ${periodEnd.toLocaleDateString('ja-JP')}`;
    const description = `${plan.name} ${input.termMonths}ヶ月分（税込）`;
    const metadata = {
      service: 'zaseki_kun',
      billing_flow: 'institutional_billing',
      userId: session.user.email,
      productType: plan.productType,
      plan: plan.plan,
      termMonths: String(input.termMonths),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      institutionName: input.institutionName,
      departmentName: input.departmentName,
      contactName: input.contactName,
      taxId: input.taxId,
      purchaseOrderNumber: input.purchaseOrderNumber,
    };

    const quote = await stripe.quotes.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      invoice_settings: {
        days_until_due: input.daysUntilDue,
      },
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product: productId,
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      description,
      header: '請求書払い（銀行振込）に利用できる見積書です。',
      footer: '同時に発行された請求書の銀行振込案内に従ってお支払いください。',
      expires_at: toUnix(addMonths(periodStart, 1)),
      metadata,
    });

    const finalizedQuote = await stripe.quotes.finalizeQuote(quote.id);

    await stripe.invoiceItems.create({
      customer: customer.id,
      amount,
      currency: 'jpy',
      description,
      period: {
        start: toUnix(periodStart),
        end: toUnix(periodEnd),
      },
      metadata,
    });

    const customFields: Stripe.InvoiceCreateParams.CustomField[] = [
      { name: '団体名', value: input.institutionName.slice(0, 30) },
      { name: '利用期間', value: periodLabel.slice(0, 30) },
      { name: '書類区分', value: '請求書・納品書対応' },
    ];

    if (input.purchaseOrderNumber) {
      customFields.push({ name: '注文番号', value: input.purchaseOrderNumber.slice(0, 30) });
    }

    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: input.daysUntilDue,
      pending_invoice_items_behavior: 'include',
      description: input.notes || description,
      footer: '銀行振込情報はStripeのHosted Invoice Pageに表示されます。振込手数料はご利用金融機関の条件に従います。',
      custom_fields: customFields,
      payment_settings: {
        payment_method_types: ['customer_balance'],
        payment_method_options: {
          customer_balance: {
            funding_type: 'bank_transfer',
            bank_transfer: {
              type: 'jp_bank_transfer',
            },
          },
        },
      },
      metadata: {
        ...metadata,
        quoteId: finalizedQuote.id,
      },
    });

    if (!invoice.id) {
      throw new Error('Stripe invoice ID was not returned');
    }

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    if (!finalizedInvoice.id) {
      throw new Error('Stripe finalized invoice ID was not returned');
    }

    const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);
    if (!sentInvoice.id) {
      throw new Error('Stripe sent invoice ID was not returned');
    }

    const appUrl = getAppUrl(request);

    return NextResponse.json({
      customerId: customer.id,
      quoteId: finalizedQuote.id,
      invoiceId: sentInvoice.id,
      amount,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      hostedInvoiceUrl: sentInvoice.hosted_invoice_url,
      invoicePdfUrl: sentInvoice.invoice_pdf,
      quotePdfUrl: `${appUrl}/api/stripe/institutional-billing/quote/${finalizedQuote.id}/pdf`,
      deliveryNoteUrl: `${appUrl}/api/stripe/institutional-billing/delivery-note?invoice=${sentInvoice.id}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 });
    }

    console.error('Institutional billing request error:', error);
    return NextResponse.json(
      { error: '請求書払いの請求書作成に失敗しました' },
      { status: 500 }
    );
  }
}
