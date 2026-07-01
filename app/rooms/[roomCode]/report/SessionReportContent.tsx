'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  Link2,
  Loader2,
  MessageSquare,
  Printer,
  ThumbsUp,
  Trash2,
  Users,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type {
  SessionReportData,
  SessionReportRun,
  SessionReportWork,
} from '@/lib/sessionReport';
import type { PollMode } from '@/lib/pollModes';

// セッションレポート本体。ホスト管理画面のタブ（embedded）と
// 印刷用スタンドアロンページの両方から使う。
// 白い1枚のドキュメント（レターヘッド＋番号付きセクション＋ヘアライン罫線）として
// 画面と印刷で同じ見た目になるよう組み、装飾は墨色＋エメラルドの2色に抑える。
// 印刷ボタンは window.print()。ホスト画面側は印刷時にサイドバー等を print:hidden で
// 落とすため、タブのフィルター適用状態のまま印刷できる。

const MODE_DOT: Record<PollMode, string> = {
  standard: 'bg-emerald-500',
  quiz: 'bg-violet-500',
  ranking: 'bg-amber-500',
  free_text: 'bg-orange-500',
};

function formatDateTime(value: string | null | undefined, timeZone?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    return date.toLocaleString('ja-JP', {
      timeZone: timeZone || 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="lg:px-6 lg:first:pl-0 lg:last:pr-0 print:px-4 print:first:pl-0 print:last:pr-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5 text-emerald-700" />
        {label}
      </dt>
      <dd className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900 print:text-2xl">
        {value}
      </dd>
      {sub && <dd className="mt-0.5 text-xs text-slate-500">{sub}</dd>}
    </div>
  );
}

function SectionHeading({
  no,
  title,
  actions,
}: {
  no: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="break-after-avoid flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-2.5">
      <h2 className="flex items-baseline gap-2.5 text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
        <span className="text-xs sm:text-sm font-extrabold tabular-nums text-emerald-700">{no}</span>
        {title}
      </h2>
      {actions}
    </div>
  );
}

function ResultBar({
  label,
  count,
  pct,
  highlight,
}: {
  label: string;
  count: number;
  pct: number;
  highlight?: boolean;
}) {
  return (
    <div className="break-inside-avoid space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-sm sm:text-base ${highlight ? 'font-semibold text-emerald-800' : 'text-slate-700'}`}>
          {highlight && <CheckCircle2 className="mr-1 inline h-4 w-4 align-[-2px] text-emerald-600" />}
          {label}
        </span>
        <span className="shrink-0 text-xs sm:text-sm tabular-nums text-slate-500">
          {count}票（{pct}%）
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-100">
        <div
          className={`h-full ${highlight ? 'bg-emerald-600' : 'bg-slate-800'}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function RunResult({ run }: { run: SessionReportRun }) {
  const { result } = run;

  if (result.kind === 'standard') {
    return (
      <div className="space-y-2.5">
        {result.options.map((opt, i) => (
          <ResultBar key={i} label={opt.label} count={opt.count} pct={opt.pct} />
        ))}
      </div>
    );
  }

  if (result.kind === 'quiz') {
    return (
      <div className="divide-y divide-slate-100">
        {result.questions.map((q, qi) => (
          <div key={qi} className="break-inside-avoid py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm sm:text-base font-semibold text-slate-900">
                <span className="mr-2 text-xs sm:text-sm font-extrabold tabular-nums text-emerald-700">
                  Q{qi + 1}
                </span>
                {q.title || `問${qi + 1}`}
              </p>
              <p className="shrink-0 text-xs sm:text-sm tabular-nums text-slate-500">
                回答 {q.respondents}人
                {q.correctRate !== null && (
                  <span className="ml-2 font-semibold text-emerald-700">正答率 {q.correctRate}%</span>
                )}
              </p>
            </div>
            <div className="mt-2.5 space-y-2">
              {q.options.map((opt, oi) => (
                <ResultBar key={oi} label={opt.label} count={opt.count} pct={opt.pct} highlight={opt.isCorrect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (result.kind === 'ranking') {
    return (
      <ol className="divide-y divide-slate-100">
        {result.entries.map((entry) => (
          <li
            key={`${entry.rank}-${entry.label}`}
            className="break-inside-avoid flex items-baseline justify-between gap-3 py-2"
          >
            <span className="text-sm sm:text-base text-slate-800">
              <span
                className={`mr-2 inline-block w-10 font-extrabold tabular-nums ${
                  entry.rank <= 3 ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {entry.rank}位
              </span>
              {entry.label}
            </span>
            <span className="shrink-0 text-xs sm:text-sm tabular-nums text-slate-500">
              {entry.score}pt / {entry.total}票
            </span>
          </li>
        ))}
      </ol>
    );
  }

  // free_text
  return (
    <div className="space-y-3">
      <p className="text-sm sm:text-base text-slate-700">
        投稿カード <span className="font-bold tabular-nums text-slate-900">{result.totalCards}</span> 件
      </p>
      {result.groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.groups.map((g) => (
            <span
              key={g.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs sm:text-sm text-slate-700"
            >
              {g.label}
              <span className="font-bold tabular-nums text-slate-900">{g.count}</span>
            </span>
          ))}
        </div>
      )}
      {result.samples.length > 0 && (
        <ul className="space-y-2">
          {result.samples.map((s, i) => (
            <li
              key={i}
              className="break-inside-avoid border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-700"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkCard({ work }: { work: SessionReportWork }) {
  return (
    <section className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
      <div className="break-after-avoid flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">{work.title}</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold tracking-wide text-slate-500">
          <span className={`h-2 w-2 rounded-full ${MODE_DOT[work.mode]}`} />
          {work.modeLabel}
        </span>
      </div>

      {work.runs.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">まだ実施されていません。</p>
      ) : (
        <div className="mt-3 space-y-6">
          {work.runs.map((run, i) => (
            <div key={i}>
              <div className="break-after-avoid mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs sm:text-sm font-semibold text-slate-500">
                  {work.runs.length > 1 ? `${i + 1}回目` : '実施結果'}
                  {run.startedAt && (
                    <span className="ml-2 font-normal">
                      {formatDateTime(run.startedAt, run.startedAtTimeZone)} 開始
                    </span>
                  )}
                </p>
                <p className="text-xs sm:text-sm tabular-nums text-slate-500">回答者 {run.respondents}人</p>
              </div>
              <RunResult run={run} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function SessionReportContent({
  roomCode,
  embedded = false,
}: {
  roomCode: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [report, setReport] = useState<SessionReportData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingDate, setDeletingDate] = useState(false);
  // ワークカードごとに実施履歴（複数回のrun）が蓄積される。
  // デフォルトは各カードの「直近の実施分のみ」を表示し、トグルで全履歴に展開できる。
  // 全履歴モードでは「どのカードの・いつの実施分か」を絞り込める。
  const [historyMode, setHistoryMode] = useState<'latest' | 'all'>('latest');
  const [workFilter, setWorkFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/rooms/${roomCode}/export?type=report`);
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'レポートの取得に失敗しました');
      }
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'レポートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [roomCode, router]);

  useEffect(() => {
    if (roomCode) load();
  }, [roomCode, load]);

  // 選択中の実施日のワークデータ（投票結果）を物理削除（復元不可）。
  const handleDeleteDate = useCallback(async () => {
    if (dateFilter === 'all') return;
    setDeletingDate(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/report?date=${encodeURIComponent(dateFilter)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: '削除エラー', description: data.error || '削除に失敗しました', variant: 'destructive', duration: 3000 });
        return;
      }
      toast({
        title: '削除しました',
        description: `${dateFilter} の実施結果（${data.deletedVotes ?? 0} 票）を削除しました`,
        duration: 2500,
      });
      setDateFilter('all');
      await load();
    } catch (e) {
      console.error('Report date delete error:', e);
      toast({ title: 'エラー', description: '削除中にエラーが発生しました', variant: 'destructive', duration: 3000 });
    } finally {
      setDeletingDate(false);
    }
  }, [dateFilter, roomCode, toast, load]);

  const runDateLabel = useCallback((run: SessionReportRun) => {
    if (!run.startedAt) return '日時不明';
    const date = new Date(run.startedAt);
    if (!Number.isFinite(date.getTime())) return '日時不明';
    try {
      return date.toLocaleDateString('ja-JP', {
        timeZone: run.startedAtTimeZone || 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    } catch {
      return date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    }
  }, []);

  const dateOptions = useMemo(() => {
    if (!report) return [] as string[];
    const seen = new Set<string>();
    const ordered: string[] = [];
    report.works
      .filter((w) => workFilter === 'all' || w.id === workFilter)
      .forEach((w) =>
        w.runs.forEach((run) => {
          const label = runDateLabel(run);
          if (!seen.has(label)) {
            seen.add(label);
            ordered.push(label);
          }
        })
      );
    return ordered;
  }, [report, workFilter, runDateLabel]);

  const visibleWorks = useMemo(() => {
    if (!report) return [] as SessionReportWork[];
    // 直近のみモード: 各カードの最新実施分（runsは昇順なので末尾）だけを表示する
    if (historyMode === 'latest') {
      return report.works
        .filter((w) => workFilter === 'all' || w.id === workFilter)
        .map((w) => ({
          ...w,
          runs: w.runs.length > 0 ? [w.runs[w.runs.length - 1]] : [],
        }));
    }
    // 全履歴モード: カード・実施日で絞り込む
    return report.works
      .filter((w) => workFilter === 'all' || w.id === workFilter)
      .map((w) => ({
        ...w,
        runs:
          dateFilter === 'all'
            ? w.runs
            : w.runs.filter((run) => runDateLabel(run) === dateFilter),
      }))
      // 絞り込み中は該当する実施回があるカードのみ表示（カード指定時は空でも表示する）
      .filter((w) => w.runs.length > 0 || workFilter === w.id);
  }, [report, historyMode, workFilter, dateFilter, runDateLabel]);

  // 複数回実施されたワークが1つでもあるか（直近のみ表示の案内・トグル表示判定に使う）
  const hasMultiRunHistory = useMemo(
    () => !!report && report.works.some((w) => w.runs.length > 1),
    [report]
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-20' : 'min-h-screen'}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          レポートを集計しています…
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 px-5 ${embedded ? 'py-20' : 'min-h-screen'}`}>
        <p className="text-sm sm:text-base text-slate-700">{error || 'レポートを表示できません'}</p>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          再読み込み
        </button>
      </div>
    );
  }

  const { room, attendance, qa, works, totals } = report;

  return (
    <div className="session-report rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-8 print:rounded-none print:p-0 print:ring-0">
      <div className="space-y-8 print:space-y-6">
        {/* ── レターヘッド ── */}
        <header className="border-b-2 border-slate-900 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                Session Report
              </p>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {room.title}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-500">
                ルームコード <span className="font-semibold tabular-nums text-slate-700">{room.code}</span>
                <span className="mx-2 text-slate-300">|</span>
                作成 {formatDateTime(room.createdAt)}
                <span className="mx-2 text-slate-300">|</span>
                レポート生成 {formatDateTime(report.generatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <a
                href={`/api/rooms/${roomCode}/export?type=polls&format=csv`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                CSV
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#2864f0] px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#285ac8]"
              >
                <Printer className="h-3.5 w-3.5" />
                印刷 / PDF
              </button>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-slate-200 print:grid-cols-4 print:gap-x-0 print:divide-x print:divide-slate-200">
            <StatTile icon={Users} label="参加者" value={totals.uniqueParticipants} sub="投票・質問の参加者数" />
            <StatTile
              icon={ClipboardList}
              label="出席"
              value={attendance.linked ? attendance.total ?? 0 : '—'}
              sub={attendance.linked ? attendance.courseName || attendance.courseCode : '未連携'}
            />
            <StatTile icon={MessageSquare} label="質問" value={qa.total} sub={`回答済み ${qa.answered}件`} />
            <StatTile icon={BarChart3} label="ワーク" value={totals.workCount} sub={`実施 ${totals.runCount}回`} />
          </dl>
        </header>

        {/* ── 出席（未連携時は「欠けた記録」スロット。画面のみ） ── */}
        {!attendance.linked && (
          <section className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4 sm:p-5 print:hidden">
            <div className="flex items-start gap-3">
              <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                  出席の記録は、まだこのレポートにありません
                </h3>
                <p className="mt-1 text-sm sm:text-base leading-relaxed text-slate-600">
                  「連携」タブでこのルームに出席フォームを紐付けると、誰が参加したかの記録もここに並び、
                  その場の反応と出席をひとつのセッションとして残せます。
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── 01 ワーク結果 ── */}
        <section className="space-y-4">
          <SectionHeading
            no="01"
            title="ワーク結果"
            actions={
              works.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  {/* 直近のみ / すべての履歴 の切替（複数回実施がある場合のみ意味を持つ） */}
                  {hasMultiRunHistory && (
                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setHistoryMode('latest')}
                        className={`h-9 rounded px-3 text-xs font-semibold transition-colors ${
                          historyMode === 'latest'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        直近のみ
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryMode('all')}
                        className={`h-9 rounded px-3 text-xs font-semibold transition-colors ${
                          historyMode === 'all'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        すべての履歴
                      </button>
                    </div>
                  )}
                  <select
                    value={workFilter}
                    onChange={(e) => {
                      setWorkFilter(e.target.value);
                      setDateFilter('all');
                    }}
                    aria-label="表示するワークカードを選択"
                    className="h-10 max-w-[220px] truncate rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="all">すべてのカード</option>
                    {works.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                      </option>
                    ))}
                  </select>
                  {/* 実施日の絞り込みは全履歴モードのときのみ */}
                  {historyMode === 'all' && (
                    <>
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        aria-label="表示する実施日を選択"
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
                      >
                        <option value="all">すべての実施日</option>
                        {dateOptions.map((label) => (
                          <option key={label} value={label}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {/* 選択中の実施日を物理削除（復元不可） */}
                      {dateFilter !== 'all' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              disabled={deletingDate}
                              aria-label="選択中の実施日を削除"
                              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 print:hidden"
                            >
                              {deletingDate ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              この日を削除
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{dateFilter} の実施結果を削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                この日に実施したワーク（投票）の結果をデータベースから完全に削除します。
                                <span className="font-medium text-red-600">この操作は取り消せません。</span>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={deletingDate}>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteDate()}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                削除する
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}
                </div>
              ) : undefined
            }
          />
          {/* 直近のみ表示中の案内 */}
          {works.length > 0 && historyMode === 'latest' && hasMultiRunHistory && (
            <p className="text-xs sm:text-sm text-slate-500 print:hidden">
              各カードの直近の実施結果のみを表示しています。過去の実施も見るには「すべての履歴」を選択してください。
            </p>
          )}
          {works.length === 0 ? (
            <p className="text-sm text-slate-500">このルームにはまだワークがありません。</p>
          ) : visibleWorks.length === 0 ? (
            <p className="text-sm text-slate-500">
              選択した条件に一致する実施結果がありません。カードまたは実施日の選択を変えてください。
            </p>
          ) : (
            <div className="space-y-5">
              {visibleWorks.map((work) => (
                <WorkCard key={work.id} work={work} />
              ))}
            </div>
          )}
        </section>

        {/* ── 02 Q&A ハイライト ── */}
        <section className="space-y-4">
          <SectionHeading no="02" title="Q&A ハイライト" />
          {qa.total === 0 ? (
            <p className="text-sm text-slate-500">質問はありませんでした。</p>
          ) : (
            <div>
              <p className="text-xs sm:text-sm text-slate-500">
                合計 <span className="font-bold tabular-nums text-slate-900">{qa.total}</span> 件 ・ いいね{' '}
                <span className="font-bold tabular-nums text-slate-900">{qa.totalUpvotes}</span> 件
              </p>
              <ul className="mt-2 divide-y divide-slate-100">
                {qa.top.map((q, i) => (
                  <li key={i} className="break-inside-avoid flex items-start justify-between gap-4 py-2.5">
                    <div>
                      <p className="text-sm sm:text-base leading-relaxed text-slate-700">{q.text}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {q.author}
                        {q.isAnswered && <span className="ml-2 font-semibold text-emerald-700">回答済み</span>}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs sm:text-sm tabular-nums text-slate-500">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      {q.upvotes}
                    </span>
                  </li>
                ))}
              </ul>
              <a
                href={`/api/rooms/${roomCode}/export?type=questions&format=csv`}
                className="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 hover:underline print:hidden"
              >
                <Download className="h-4 w-4" />
                質問一覧をCSVでダウンロード
              </a>
            </div>
          )}
        </section>

        {/* ── フッター ── */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-400">
          <span>ざせきくん セッションレポート ・ {room.code}</span>
          <span className="tabular-nums">{formatDateTime(report.generatedAt)} 生成</span>
          {!embedded && (
            <Link
              href={`/rooms/${roomCode}/host?tab=report`}
              className="inline-flex items-center gap-1 text-emerald-700 hover:underline print:hidden"
            >
              <ArrowLeft className="h-3 w-3" />
              ホスト画面に戻る
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}
