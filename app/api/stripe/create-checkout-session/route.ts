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

    // 商品タイプに応じて価格を設定
    let priceData;
    switch (productType) {
      case 'custom_form':
        priceData = {
          currency: 'jpy',
          product_data: {
            name: 'ざせきくん - カスタムフォーム作成',
            description: '出席管理フォームをカスタマイズできる機能です。デフォルトフィールドの有効/無効化や独自項目の追加が可能になります。',
            images: ['https://res.cloudinary.com/dz9trbwma/image/upload/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png'],
            metadata: {
              category: 'software',
              type: 'digital_service',
              service_type: 'education_management',
              feature: 'custom_form_builder',
              app_name: 'zaseki_kun'
            },
          },
          unit_amount: 200, // 200円
        };
        break;
      default:
        // デフォルトケースを追加
        return NextResponse.json(
          { error: 'サポートされていない商品タイプです' },
          { status: 400 }
        );
    }

    // priceDataが未定義でないことを確認
    if (!priceData) {
      return NextResponse.json(
        { error: '商品情報の設定に失敗しました' },
        { status: 400 }
      );
    }

    // Stripe Checkoutセッションを作成
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: priceData,
          quantity: 1,
        },
      ],
      mode: 'payment', // 単発決済
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: session.user.email,
      metadata: {
        userId: session.user.email,
        productType: productType,
        service: 'zaseki_kun',
        feature: 'custom_form',
        category: 'software'
      },
      locale: 'ja', // 日本語表示
      // 税金設定（必要に応じて）
      automatic_tax: {
        enabled: false, // 日本の消費税は手動設定の場合
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
