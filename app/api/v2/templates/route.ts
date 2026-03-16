// /api/v2/templates - フォームテンプレート一覧・作成
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

// GET: テンプレート一覧（公開）
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('form_templates')
      .select('*')
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: templates, error } = await query;

    if (error) {
      return NextResponse.json({ message: 'Failed to fetch templates', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] }, { status: 200 });
  } catch (error) {
    console.error('Error in templates API:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST: カスタムテンプレート作成（認証必須）
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, category, fields, enabledDefaultFields } = body;

    if (!name) {
      return NextResponse.json({ message: 'name is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // slugを生成（ユニーク）
    const slug = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const { data: template, error } = await supabase
      .from('form_templates')
      .insert({
        name,
        slug,
        description: description || null,
        category: category || 'custom',
        fields: fields || [],
        enabled_default_fields: enabledDefaultFields || ['date', 'class_name', 'name'],
        is_system: false,
        created_by: user.email,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ message: 'Failed to create template', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
