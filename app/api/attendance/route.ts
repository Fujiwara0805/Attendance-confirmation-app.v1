import { NextResponse } from 'next/server';
import type { AttendanceFormData } from '@/app/types';

const attendanceData: AttendanceFormData[] = [];

export async function POST(request: Request) {
  try {
    const data = await request.json();
    attendanceData.push(data);
    
    return NextResponse.json({ message: '出席を記録しました' }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: '出席の記録に失敗しました' },
      { status: 500 }
    );
  }
}