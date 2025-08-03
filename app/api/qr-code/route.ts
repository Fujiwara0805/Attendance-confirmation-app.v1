// app/api/qr-code/route.ts (高速化版)
import { NextRequest, NextResponse } from 'next/server';

// QRコードライブラリを事前に読み込み（初回のみ）
let QRCode: any;
try {
  QRCode = require('qrcode');
} catch (error) {
  console.error('qrcodeパッケージの事前読み込み失敗:', error);
}

export async function POST(req: NextRequest) {
  const startTime = performance.now();
  console.log('⚡ QRコード高速API開始');
  
  try {
    const { url } = await req.json();
    const parseTime = performance.now();
    console.log(`📝 リクエスト解析: ${(parseTime - startTime).toFixed(0)}ms - URL:`, url);
    
    if (!url) {
      console.log('❌ URLが提供されていません');
      return NextResponse.json(
        { error: 'URLが提供されていません' },
        { status: 400 }
      );
    }

    // 事前読み込み済みライブラリを使用
    if (!QRCode) {
      console.error('❌ qrcodeパッケージが利用できません');
      return NextResponse.json(
        { error: 'qrcodeパッケージがインストールされていません' },
        { status: 500 }
      );
    }

    // 高速QRコード生成（最適化設定）
    console.log('🚀 高速QRコード生成開始...');
    const genStartTime = performance.now();
    
    const qrCodeDataURL = await QRCode.toDataURL(url, {
      width: 256,
      margin: 1, // マージンを小さくして高速化
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'L', // Lレベルで高速化（最低限のエラー訂正）
      type: 'image/png',
      quality: 0.8, // 品質を少し下げて高速化
      rendererOpts: {
        quality: 0.8
      }
    });
    
    const genEndTime = performance.now();
    const totalTime = genEndTime - startTime;
    
    console.log(`✅ QRコード生成完了！生成時間: ${(genEndTime - genStartTime).toFixed(0)}ms / 総時間: ${totalTime.toFixed(0)}ms`);
    
    return NextResponse.json({ 
      qrCodeDataURL,
      success: true,
      generationTime: `${totalTime.toFixed(0)}ms` // デバッグ用
    });

  } catch (error) {
    const errorTime = performance.now();
    console.error(`❌ QRコード生成エラー (${(errorTime - startTime).toFixed(0)}ms):`, error);
    return NextResponse.json(
      { error: `QRコードの生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    );
  }
}

// GET メソッドでもテストできるようにする
export async function GET() {
  console.log('🔍 QRコード高速API のGETテスト');
  return NextResponse.json({ 
    message: 'QRコード高速API は正常に動作しています',
    timestamp: new Date().toISOString(),
    optimization: 'エラー訂正レベル: L, マージン: 1, 品質: 0.8'
  });
}