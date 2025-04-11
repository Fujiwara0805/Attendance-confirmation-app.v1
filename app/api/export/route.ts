import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import type { AttendanceFormData } from '@/app/types';

export async function GET() {
  try {
    // ここでデータベースからデータを取得する処理を実装
    // 現在はメモリ内のデータを使用
    const attendanceData: AttendanceFormData[] = [];
    
    // CSVデータの作成
    const csvContent = [
      ['日付', '講義名', '学籍番号', '氏名', '学年', '学科・コース', '感想'],
      ...attendanceData.map(record => [
        record.date,
        record.lectureName,
        record.studentId,
        record.name,
        record.year,
        record.department,
        record.feedback
      ])
    ].map(row => row.join(',')).join('\n');

    // CSVファイルの保存
    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    const filePath = path.join(process.cwd(), 'public', fileName);
    await writeFile(filePath, csvContent);

    return NextResponse.json({ fileName }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'CSVファイルの作成に失敗しました' },
      { status: 500 }
    );
  }
}