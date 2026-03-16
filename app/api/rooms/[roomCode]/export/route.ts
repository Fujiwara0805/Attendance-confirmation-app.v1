import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// GET: Export room data (host only)
export async function GET(
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
      .select('id, host_id, title, created_at')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const type = req.nextUrl.searchParams.get('type') || 'summary';
    const format = req.nextUrl.searchParams.get('format') || 'json';

    if (type === 'questions') {
      const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .eq('room_id', room.id)
        .order('upvote_count', { ascending: false });

      if (format === 'csv') {
        const csv = questionsToCSV(questions || []);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="questions-${params.roomCode}.csv"`,
          },
        });
      }
      return NextResponse.json(questions);
    }

    if (type === 'polls') {
      const { data: polls } = await supabase
        .from('polls')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false });

      const pollIds = (polls || []).map((p) => p.id);
      let votes: Array<{ poll_id: string; option_index: number | null; value: string | null; participant_id: string }> = [];
      if (pollIds.length > 0) {
        const { data } = await supabase
          .from('poll_votes')
          .select('poll_id, option_index, value, participant_id')
          .in('poll_id', pollIds);
        votes = data || [];
      }

      const pollResults = (polls || []).map((poll) => {
        const pollVotes = votes.filter((v) => v.poll_id === poll.id);
        const optionCounts: Record<number, number> = {};
        pollVotes.forEach((v) => {
          if (v.option_index !== null) {
            optionCounts[v.option_index] = (optionCounts[v.option_index] || 0) + 1;
          }
        });

        return {
          ...poll,
          totalVotes: pollVotes.length,
          results: (poll.options as string[]).map((opt: string, i: number) => ({
            option: opt,
            count: optionCounts[i] || 0,
            percentage: pollVotes.length > 0
              ? Math.round(((optionCounts[i] || 0) / pollVotes.length) * 100)
              : 0,
          })),
        };
      });

      if (format === 'csv') {
        const csv = pollsToCSV(pollResults);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="polls-${params.roomCode}.csv"`,
          },
        });
      }
      return NextResponse.json(pollResults);
    }

    // Default: summary
    const [questionsRes, pollsRes, votesRes] = await Promise.all([
      supabase.from('questions').select('id, upvote_count, text').eq('room_id', room.id).order('upvote_count', { ascending: false }).limit(5),
      supabase.from('polls').select('id, question, status').eq('room_id', room.id),
      supabase.from('poll_votes').select('participant_id').eq('room_id', room.id),
    ]);

    const questions = questionsRes.data || [];
    const polls = pollsRes.data || [];
    const uniqueParticipants = new Set((votesRes.data || []).map((v) => v.participant_id));

    // Also count unique question participants from question_votes
    const { data: qVotes } = await supabase
      .from('question_votes')
      .select('participant_id, question_id, questions!inner(room_id)')
      .eq('questions.room_id', room.id);

    if (qVotes) {
      qVotes.forEach((v) => uniqueParticipants.add(v.participant_id));
    }

    return NextResponse.json({
      room: { title: room.title, code: params.roomCode, createdAt: room.created_at },
      stats: {
        totalQuestions: questions.length,
        totalPolls: polls.length,
        totalUpvotes: questions.reduce((sum, q) => sum + (q.upvote_count || 0), 0),
        uniqueParticipants: uniqueParticipants.size,
      },
      topQuestions: questions.slice(0, 5),
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

function questionsToCSV(questions: Array<{ text: string; author_name: string; upvote_count: number; is_answered: boolean; created_at: string }>) {
  const header = '質問,投稿者,いいね数,回答済み,投稿日時\n';
  const rows = questions.map((q) =>
    `"${q.text.replace(/"/g, '""')}","${q.author_name}",${q.upvote_count},${q.is_answered ? 'はい' : 'いいえ'},"${new Date(q.created_at).toLocaleString('ja-JP')}"`
  ).join('\n');
  return '\uFEFF' + header + rows; // BOM for Excel
}

function pollsToCSV(polls: Array<{ question: string; totalVotes: number; results: Array<{ option: string; count: number; percentage: number }> }>) {
  const header = '投票タイトル,選択肢,得票数,得票率\n';
  const rows = polls.flatMap((p) =>
    p.results.map((r) =>
      `"${p.question.replace(/"/g, '""')}","${r.option.replace(/"/g, '""')}",${r.count},${r.percentage}%`
    )
  ).join('\n');
  return '\uFEFF' + header + rows;
}
