import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// GET: Fetch polls for a room (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { data: polls, error } = await supabase
      .from('polls')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch vote counts for each poll
    const pollIds = (polls || []).map((p) => p.id);
    let votesMap: Record<string, Array<{ option_index: number | null; value: string | null }>> = {};

    if (pollIds.length > 0) {
      const { data: votes } = await supabase
        .from('poll_votes')
        .select('poll_id, option_index, value')
        .in('poll_id', pollIds);

      if (votes) {
        votes.forEach((v) => {
          if (!votesMap[v.poll_id]) votesMap[v.poll_id] = [];
          votesMap[v.poll_id].push({ option_index: v.option_index, value: v.value });
        });
      }
    }

    const pollsWithVotes = (polls || []).map((p) => ({
      ...p,
      votes: votesMap[p.id] || [],
      totalVotes: (votesMap[p.id] || []).length,
    }));

    return NextResponse.json(pollsWithVotes);
  } catch (err) {
    console.error('Polls fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch polls' }, { status: 500 });
  }
}

// POST: Create a new poll (host only)
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { question, type, options, allowMultiple } = await req.json();
    if (!question || !type) {
      return NextResponse.json({ error: 'Question and type are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('polls')
      .insert({
        room_id: room.id,
        question: question.trim(),
        type,
        options: options || [],
        allow_multiple: allowMultiple || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Poll creation error:', err);
    return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 });
  }
}
