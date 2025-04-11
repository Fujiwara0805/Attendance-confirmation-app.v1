import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Supabaseからすべての出席データを取得
    const { data: attendanceData, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`データ取得エラー: ${error.message}`);
    }

    // CSVヘッダー
    const headers = [
      '日付',
      '講義名',
      '学籍番号',
      '学年',
      '名前',
      '学科・コース',
      '感想',
      '緯度',
      '経度',
      '登録日時'
    ];

    // CSVデータの作成
    const csvRows = [
      headers.join(','),
      ...attendanceData.map(record => [
        record.date,
        record.class_name,
        record.student_id,
        record.grade,
        record.name,
        record.department,
        // カンマやダブルクォートをエスケープ
        `"${(record.feedback || '').replace(/"/g, '""')}"`,
        record.latitude,
        record.longitude,
        record.created_at
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');

    // CSVをレスポンスとして返す（ファイル保存せずに直接ダウンロード）
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('CSVエクスポートエラー:', error);
    return NextResponse.json(
      { error: 'CSVファイルの作成に失敗しました' },
      { status: 500 }
    );
  }
}