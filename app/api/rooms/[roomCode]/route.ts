import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// GET: Fetch room by code (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('rooms')
      .select('id, code, title, status, host_id, created_at')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Room fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
  }
}

// PATCH: Update room (host only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const body = await req.json();

    // Verify ownership
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title) updates.title = body.title;
    if (body.status) updates.status = body.status;

    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('code', params.roomCode.toUpperCase())
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Room update error:', err);
    return NextResponse.json({ error: 'Failed to update room' }, { status: 500 });
  }
}

// DELETE: Delete room and related data (host only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const code = params.roomCode.toUpperCase();

    // Verify ownership
    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('code', code)
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete related data first (poll_votes → polls, question_votes → questions)
    const { data: polls } = await supabase.from('polls').select('id').eq('room_id', room.id);
    if (polls && polls.length > 0) {
      const pollIds = polls.map(p => p.id);
      await supabase.from('poll_votes').delete().in('poll_id', pollIds);
      await supabase.from('polls').delete().eq('room_id', room.id);
    }

    const { data: questions } = await supabase.from('questions').select('id').eq('room_id', room.id);
    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id);
      await supabase.from('question_votes').delete().in('question_id', questionIds);
      await supabase.from('questions').delete().eq('room_id', room.id);
    }

    // Delete the room
    const { error } = await supabase.from('rooms').delete().eq('id', room.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Room delete error:', err);
    return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
  }
}
