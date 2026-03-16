import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET: Fetch questions for a room (public)
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

    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('room_id', room.id)
      .order('is_pinned', { ascending: false })
      .order('upvote_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Questions fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

// POST: Submit a question (public — no auth required)
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const supabase = createServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('id, status')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    if (room.status !== 'active') {
      return NextResponse.json({ error: 'Room is closed' }, { status: 400 });
    }

    const { text, authorName, isAnonymous } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('questions')
      .insert({
        room_id: room.id,
        text: text.trim(),
        author_name: isAnonymous ? 'Anonymous' : (authorName || 'Anonymous'),
        is_anonymous: isAnonymous !== false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Question creation error:', err);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}
