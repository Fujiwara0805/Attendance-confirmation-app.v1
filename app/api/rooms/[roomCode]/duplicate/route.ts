import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { generateRoomCode } from '@/lib/roomUtils';
import { canCreateRoom, getUserPlanInfo, PLAN_LIMITS } from '@/lib/subscription';
import { buildPollOptionsPayload, extractPollPayload, type PollMeta } from '@/lib/pollModes';
import { areOrgCoMembers } from '@/lib/organization';

// POST: ルームを複製する（ホスト本人、または同一組織のメンバー）
// ワーク構成（カード・設定・並び順）は引き継ぎ、票・質問・実施履歴は引き継がない。
// 毎週の授業・研修で「同じ構成をもう一度」を1操作にする反復利用の中核機能。
// 組織メンバーが複製した場合も所有者は操作者本人になり、複製元の票・質問には一切アクセスできない。
export async function POST(
  _req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: source } = await supabase
      .from('rooms')
      .select('id, host_id, title, settings, moderation_enabled, linked_course_code')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const isOwner = source.host_id === session.email;
    if (!isOwner && !(await areOrgCoMembers(session.email, source.host_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    const { data: newRoom, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: session.email,
        title: `${source.title}のコピー`,
        settings: source.settings || {},
        moderation_enabled: !!source.moderation_enabled,
        // 組織メンバーによる複製では、他人所有フォームへのリンクを引き継がない
        // （リンク先の付け替えは所有者チェックで403になるため、残すと外せない紐づけが残る）
        linked_course_code: isOwner ? source.linked_course_code || null : null,
      })
      .select()
      .single();

    if (roomError || !newRoom) throw roomError || new Error('Failed to create room');

    // ワークカードを複製（draft状態・実施履歴なし）
    const { data: polls } = await supabase
      .from('polls')
      .select('question, type, options, allow_multiple, max_selections, created_at')
      .eq('room_id', source.id)
      .order('created_at', { ascending: true });

    if (polls && polls.length > 0) {
      const newPolls = polls.map((poll) => {
        const { meta, options } = extractPollPayload(poll.options);
        // 実施履歴・開始時刻系のメタは複製しない（構成のみ引き継ぐ）
        const cleanMeta: PollMeta = { ...meta };
        delete cleanMeta.startedAtClientAt;
        delete cleanMeta.startedAtTimeZone;
        delete cleanMeta.runStartedAtByClearedAt;
        delete cleanMeta.runStartedAtClientAtByClearedAt;
        delete cleanMeta.runStartedAtTimeZoneByClearedAt;
        delete cleanMeta.runVoteSnapshotsByClearedAt;
        cleanMeta.bulkOrder = null;

        return {
          room_id: newRoom.id,
          question: poll.question,
          type: poll.type,
          options: buildPollOptionsPayload(cleanMeta, options),
          allow_multiple: poll.allow_multiple,
          max_selections: poll.max_selections,
          status: 'draft',
        };
      });

      const { error: pollsError } = await supabase.from('polls').insert(newPolls);
      if (pollsError) {
        // ワーク複製に失敗した場合は中途半端なルームを残さない
        await supabase.from('rooms').delete().eq('id', newRoom.id);
        throw pollsError;
      }
    }

    return NextResponse.json(
      { room: newRoom, copiedPolls: polls?.length || 0 },
      { status: 201 }
    );
  } catch (err) {
    console.error('Room duplicate error:', err);
    return NextResponse.json({ error: 'Failed to duplicate room' }, { status: 500 });
  }
}
