import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

function toPercent(value: unknown) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

// PATCH: 投稿者本人による自由回答の編集（participantId 指定）/ ホストによるボード配置・分類
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomCode: string; pollId: string; voteId: string } }
) {
  try {
    const supabase = createServerClient();

    const body = (await req.json().catch(() => ({}))) as {
      participantId?: string;
      value?: string;
      displayX?: number | null;
      displayY?: number | null;
      groupLabel?: string | null;
      pinned?: boolean;
    };

    // 投稿者本人による編集: セッション不要・participantId による本人確認
    if (typeof body.participantId === 'string' && typeof body.value === 'string') {
      const trimmedValue = body.value.trim().slice(0, 160);
      if (!trimmedValue) {
        return NextResponse.json({ error: '回答を入力してください' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('poll_votes')
        .update({ value: trimmedValue })
        .eq('id', params.voteId)
        .eq('poll_id', params.pollId)
        .eq('participant_id', body.participantId)
        .is('cleared_at', null)
        .select()
        .single();
      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    // ここから先はホスト専用（ボード上の配置・分類）
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const displayX = toPercent(body.displayX);
    const displayY = toPercent(body.displayY);
    const groupLabel =
      typeof body.groupLabel === 'string' && body.groupLabel.trim()
        ? body.groupLabel.trim().slice(0, 40)
        : null;

    const update: Record<string, unknown> = {
      display_x: groupLabel ? null : displayX,
      display_y: groupLabel ? null : displayY,
      group_label: groupLabel,
    };
    if (typeof body.pinned === 'boolean') update.is_pinned = body.pinned;

    const { data, error } = await supabase
      .from('poll_votes')
      .update(update)
      .eq('id', params.voteId)
      .eq('poll_id', params.pollId)
      .eq('room_id', room.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Free text response arrangement error:', err);
    return NextResponse.json({ error: 'Failed to update response' }, { status: 500 });
  }
}

// DELETE: 投稿者本人が自分の自由回答を削除（cleared_at を立てるソフト削除でリアルタイム伝播）
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomCode: string; pollId: string; voteId: string } }
) {
  try {
    const participantId = req.nextUrl.searchParams.get('participantId');
    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('poll_votes')
      .update({ cleared_at: new Date().toISOString() })
      .eq('id', params.voteId)
      .eq('poll_id', params.pollId)
      .eq('participant_id', participantId)
      .is('cleared_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Free text response delete error:', err);
    return NextResponse.json({ error: 'Failed to delete response' }, { status: 500 });
  }
}
