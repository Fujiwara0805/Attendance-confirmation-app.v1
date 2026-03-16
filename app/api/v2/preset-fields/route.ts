import { NextResponse } from 'next/server';
import { presetFields, presetCategoryLabels } from '@/lib/dynamicFormUtils';

// GET: プリセットフィールド一覧を取得（認証不要）
export async function GET() {
  return NextResponse.json({
    fields: presetFields,
    categories: presetCategoryLabels,
  });
}
