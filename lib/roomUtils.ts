import { createServerClient } from './supabase';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
const CODE_LENGTH = 6;

export async function generateRoomCode(): Promise<string> {
  const supabase = createServerClient();
  let code = '';
  let attempts = 0;

  while (attempts < 10) {
    code = Array.from({ length: CODE_LENGTH }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');

    const { data } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (!data) return code; // no collision
    attempts++;
  }

  throw new Error('Failed to generate unique room code');
}

export function getRoomUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  return `${base}/rooms/${code}`;
}
