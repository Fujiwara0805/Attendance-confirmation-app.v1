import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// POST: Submit a vote on a poll (public)
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string; pollId: string } }
) {
  try {
    const { participantId, optionIndex, value } = await req.json();
    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify poll exists and is active
    const { data: poll } = await supabase
      .from('polls')
      .select('id, room_id, status')
      .eq('id', params.pollId)
      .single();

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    if (poll.status !== 'active') {
      return NextResponse.json({ error: 'Poll is not active' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('poll_votes')
      .upsert(
        {
          poll_id: params.pollId,
          room_id: poll.room_id,
          participant_id: participantId,
          option_index: optionIndex ?? null,
          value: value ?? null,
        },
        { onConflict: 'poll_id,participant_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Poll vote error:', err);
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
  }
}
