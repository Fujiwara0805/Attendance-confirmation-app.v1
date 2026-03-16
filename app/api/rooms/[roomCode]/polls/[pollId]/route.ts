import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// PATCH: Update poll status (host only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomCode: string; pollId: string } }
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

    const { status } = await req.json();
    if (!status || !['draft', 'active', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // If activating, close any other active poll in this room
    if (status === 'active') {
      await supabase
        .from('polls')
        .update({ status: 'closed' })
        .eq('room_id', room.id)
        .eq('status', 'active');
    }

    const { data, error } = await supabase
      .from('polls')
      .update({ status })
      .eq('id', params.pollId)
      .eq('room_id', room.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Poll update error:', err);
    return NextResponse.json({ error: 'Failed to update poll' }, { status: 500 });
  }
}
