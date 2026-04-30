import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// PATCH: Update question (text edit by participant, or status/answered/pinned by host)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomCode: string; questionId: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const body = await req.json();
    const { text, participantId, status, isAnswered, isPinned } = body;

    // ホスト操作（status / is_answered / is_pinned）の場合
    if (status !== undefined || isAnswered !== undefined || isPinned !== undefined) {
      const session = await getCurrentUser();
      if (!session?.email || session.email !== room.host_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const updates: Record<string, unknown> = {};
      if (status !== undefined) {
        if (!['pending', 'approved', 'rejected'].includes(status)) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        updates.status = status;
      }
      if (typeof isAnswered === 'boolean') updates.is_answered = isAnswered;
      if (typeof isPinned === 'boolean') updates.is_pinned = isPinned;

      const { data, error } = await supabase
        .from('questions')
        .update(updates)
        .eq('id', params.questionId)
        .eq('room_id', room.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    // 参加者によるテキスト編集
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    if (participantId) {
      const { data: question } = await supabase
        .from('questions')
        .select('participant_id')
        .eq('id', params.questionId)
        .eq('room_id', room.id)
        .single();

      if (question?.participant_id && question.participant_id !== participantId) {
        return NextResponse.json({ error: 'Not authorized to edit this question' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('questions')
      .update({ text: text.trim() })
      .eq('id', params.questionId)
      .eq('room_id', room.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Question update error:', err);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }
}

// DELETE: Delete a question (device ownership or host required)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomCode: string; questionId: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if caller is participant (via query param) — verify ownership
    const participantId = req.nextUrl.searchParams.get('participantId');
    if (participantId) {
      const { data: question } = await supabase
        .from('questions')
        .select('participant_id')
        .eq('id', params.questionId)
        .eq('room_id', room.id)
        .single();

      if (question?.participant_id && question.participant_id !== participantId) {
        return NextResponse.json({ error: 'Not authorized to delete this question' }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', params.questionId)
      .eq('room_id', room.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Question delete error:', err);
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}
