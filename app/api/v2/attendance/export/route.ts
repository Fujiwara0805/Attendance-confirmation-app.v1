// /api/v2/attendance/export - 出席データエクスポート（CSV/Excel/JSON）
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('course_id');
    const courseCode = searchParams.get('course_code');
    const date = searchParams.get('date'); // YYYY-MM-DD
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const format = searchParams.get('format') || 'csv'; // csv | json | excel

    if (!courseId && !courseCode) {
      return NextResponse.json({ message: 'course_id or course_code is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // 講義情報を取得してオーナーチェック
    let courseQuery = supabase.from('courses').select('id, code, name, teacher_email, category, custom_fields');
    if (courseId) {
      courseQuery = courseQuery.eq('id', courseId);
    } else {
      courseQuery = courseQuery.eq('code', courseCode);
    }
    const { data: course, error: courseError } = await courseQuery.single();

    if (courseError || !course) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    // オーナーチェック: 自分の講義のデータのみ取得可能
    if (course.teacher_email !== user.email) {
      return NextResponse.json({
        message: 'Forbidden: この講義のデータにアクセスする権限がありません'
      }, { status: 403 });
    }

    // 出席データ取得。PostgREST は既定の行数上限（多くの環境で1000行）で暗黙に打ち切るため、
    // range で1000行ずつ全件ページネーションし、大規模講義でも CSV/Excel が欠落しないようにする。
    const PAGE_SIZE = 1000;
    const records: Record<string, any>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let pageQuery = supabase
        .from('attendance')
        .select('*')
        .eq('course_id', course.id)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      // 日付フィルタ
      if (date) {
        pageQuery = pageQuery.eq('attended_at', date);
      } else {
        if (dateFrom) pageQuery = pageQuery.gte('attended_at', dateFrom);
        if (dateTo) pageQuery = pageQuery.lte('attended_at', dateTo);
      }

      const { data: page, error: pageError } = await pageQuery;
      if (pageError) {
        console.error('Error fetching attendance:', pageError);
        return NextResponse.json({ message: 'Failed to fetch attendance data' }, { status: 500 });
      }
      if (!page || page.length === 0) break;
      records.push(...(page as Record<string, any>[]));
      if (page.length < PAGE_SIZE) break;
    }

    // JSON形式
    if (format === 'json') {
      return NextResponse.json({
        course: {
          id: course.id,
          code: course.code,
          name: course.name,
          category: course.category,
        },
        exportedAt: new Date().toISOString(),
        totalRecords: records.length,
        filters: { date, dateFrom, dateTo },
        records: records.map(r => ({
          id: r.id,
          studentId: r.student_id,
          studentName: r.student_name,
          grade: r.grade,
          department: r.department,
          feedback: r.feedback,
          customData: r.custom_data,
          latitude: r.latitude,
          longitude: r.longitude,
          isOnCampus: r.is_on_campus,
          attendedAt: r.attended_at,
          createdAt: r.created_at,
        })),
      });
    }

    // CSV形式（Excel対応BOM付き）
    const csvRows: string[] = [];
    const customFieldDefs: Array<{ name: string; label: string }> = course.custom_fields || [];
    const isCustomForm = customFieldDefs.length > 0;

    // regionフィールドのJSON値をパースするヘルパー
    const parseRegionValue = (val: any): { prefecture: string; city: string } => {
      if (!val) return { prefecture: '', city: '' };
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          return { prefecture: parsed.prefecture || '', city: parsed.city || '' };
        } catch {
          return { prefecture: val, city: '' };
        }
      }
      if (typeof val === 'object') {
        return { prefecture: val.prefecture || '', city: val.city || '' };
      }
      return { prefecture: '', city: '' };
    };

    if (isCustomForm) {
      // カスタムフォーム: custom_fieldsに定義された項目のみ出力
      // regionフィールドは都道府県・市区町村の2列に分割
      const headers: string[] = [];
      customFieldDefs.forEach((f: any) => {
        if (f.type === 'region') {
          headers.push('都道府県', '市区町村');
        } else {
          headers.push(f.label || f.name);
        }
      });
      headers.push('出席日', '登録日時');
      csvRows.push(headers.map(h => `"${h}"`).join(','));

      records.forEach(r => {
        const row: string[] = [];
        customFieldDefs.forEach((f: any) => {
          const val = r.custom_data?.[f.name] ?? '';
          if (f.type === 'region') {
            const region = parseRegionValue(val);
            row.push(region.prefecture.replace(/"/g, '""'));
            row.push(region.city.replace(/"/g, '""'));
          } else {
            row.push(String(val).replace(/"/g, '""').replace(/\n/g, ' '));
          }
        });
        row.push(r.attended_at || '', r.created_at || '');
        csvRows.push(row.map(v => `"${v}"`).join(','));
      });
    } else {
      // 標準出席フォーム: デフォルト7項目を出力
      const headers = [
        '学籍番号', '氏名', '学年', '学科・コース',
        'レポート・感想', '出席日', '登録日時'
      ];
      csvRows.push(headers.map(h => `"${h}"`).join(','));

      records.forEach(r => {
        const row = [
          r.student_id || '',
          r.student_name || '',
          r.grade || '',
          r.department || '',
          r.feedback || '',
          r.attended_at || '',
          r.created_at || '',
        ];
        csvRows.push(row.map(v => `"${v}"`).join(','));
      });
    }

    const csvContent = csvRows.join('\n');
    const BOM = '\uFEFF';
    const csvWithBom = BOM + csvContent;

    // ファイル名生成
    const dateStr = date || `${dateFrom || 'all'}_${dateTo || 'all'}`;
    const safeName = course.name.replace(/[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_');
    const fileName = `${safeName}_出席データ_${dateStr}.csv`;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });

  } catch (error) {
    console.error('Error in export API:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v2/attendance/export?course_id=...&date=YYYY-MM-DD
// 特定の日の出席データを物理削除する（オーナーのみ・復元不可）。
// 誤って全件削除しないよう date（特定の日）の指定を必須にする。
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('course_id');
    const courseCode = searchParams.get('course_code');
    const date = searchParams.get('date'); // YYYY-MM-DD（必須）

    if (!courseId && !courseCode) {
      return NextResponse.json({ message: 'course_id or course_code is required' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ message: '削除するには date（特定の日）の指定が必須です' }, { status: 400 });
    }

    const supabase = createServerClient();

    let courseQuery = supabase.from('courses').select('id, code, teacher_email');
    if (courseId) {
      courseQuery = courseQuery.eq('id', courseId);
    } else {
      courseQuery = courseQuery.eq('code', courseCode);
    }
    const { data: course, error: courseError } = await courseQuery.single();

    if (courseError || !course) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }
    if (course.teacher_email !== user.email) {
      return NextResponse.json({
        message: 'Forbidden: この講義のデータを削除する権限がありません',
      }, { status: 403 });
    }

    const { data: deleted, error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('course_id', course.id)
      .eq('attended_at', date)
      .select('id');

    if (deleteError) {
      console.error('Error deleting attendance:', deleteError);
      return NextResponse.json({ message: 'Failed to delete attendance data' }, { status: 500 });
    }

    return NextResponse.json({ deleted: deleted?.length ?? 0, date });
  } catch (error) {
    console.error('Error in attendance delete API:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
