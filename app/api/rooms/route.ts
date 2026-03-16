import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { generateRoomCode } from '@/lib/roomUtils';
import { canCreateRoom, getUserPlanInfo, PLAN_LIMITS } from '@/lib/subscription';

// POST: Create a new room (auth required)
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title } = await req.json();
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // ルーム作成上限チェック
    const allowed = await canCreateRoom(session.email);
    if (!allowed) {
      const planInfo = await getUserPlanInfo(session.email);
      return NextResponse.json({
        error: `ルーム作成上限（${PLAN_LIMITS[planInfo.subscription.plan].maxRooms}個）に達しています。Proプランにアップグレードしてください。`,
        code: 'PLAN_LIMIT_EXCEEDED',
        usage: planInfo.usage,
        limits: planInfo.limits,
      }, { status: 403 });
    }

    const code = await generateRoomCode();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: session.email,
        title: title.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Room creation error:', err);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

// GET: List rooms for the current host (auth required)
export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('host_id', session.email)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Room list error:', err);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}
