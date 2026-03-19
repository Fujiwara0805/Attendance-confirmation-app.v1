import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { productType, successUrl, cancelUrl } = await request.json();

    if (productType !== 'pro_subscription' && productType !== 'enterprise_subscription') {
      return NextResponse.json(
        { error: 'サポートされていない商品タイプです' },
        { status: 400 }
      );
    }

    const isEnterprise = productType === 'enterprise_subscription';

    // 既存のStripe Customerを検索、なければ作成
    const customers = await stripe.customers.list({
      email: session.user.email,
      limit: 1,
    });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: {
          service: 'zaseki_kun',
        },
      });
      customerId = customer.id;
    }

    // サブスクリプション用Checkoutセッションを作成
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: isEnterprise ? 'ざせきくん Enterprise プラン' : 'ざせきくん Pro プラン',
              description: isEnterprise
                ? 'フォーム無制限・ルーム無制限・複数端末同時利用。法人・チームでの本格運用に最適なプランです。'
                : 'フォーム無制限・ルーム無制限。出席管理をフル活用できるプランです。',
              images: ['https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png'],
              metadata: {
                category: 'software',
                type: 'digital_service',
                service_type: 'education_management',
                app_name: 'zaseki_kun',
              },
            },
            unit_amount: isEnterprise ? 2000 : 550,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: session.user.email,
        productType,
        service: 'zaseki_kun',
      },
      locale: 'ja',
      automatic_tax: {
        enabled: false,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Stripe checkout session creation error:', error);
    return NextResponse.json(
      { error: '決済セッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}
