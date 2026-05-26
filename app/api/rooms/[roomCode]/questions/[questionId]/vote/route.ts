import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// POST: Toggle upvote on a question (public)
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string; questionId: string } }
) {
  try {
    const { participantId } = await req.json();
    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { data: question } = await supabase
      .from('questions')
      .select('id')
      .eq('id', params.questionId)
      .eq('room_id', room.id)
      .is('deleted_at', null)
      .single();

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const { data, error } = await supabase.rpc('toggle_upvote', {
      p_question_id: params.questionId,
      p_participant_id: participantId,
    });

    if (error) throw error;

    return NextResponse.json({ upvote_count: data });
  } catch (err) {
    console.error('Vote toggle error:', err);
    return NextResponse.json({ error: 'Failed to toggle vote' }, { status: 500 });
  }
}
