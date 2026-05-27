'use client';

interface QuizTimerRingProps {
  /** 残り秒数 */
  remaining: number;
  /** 制限秒数 */
  total: number;
  size?: number;
}

/**
 * クイズ形式の解答時間カウントダウンリング。残り時間が減ると amber→rose に変化。
 */
export default function QuizTimerRing({ remaining, total, size = 44 }: QuizTimerRingProps) {
  const safeTotal = Math.max(total, 1);
  const clamped = Math.max(0, Math.min(remaining, safeTotal));
  const ratio = clamped / safeTotal;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const color =
    ratio > 0.5 ? '#10b981' : ratio > 0.25 ? '#f59e0b' : '#f43f5e';
  const expired = clamped <= 0;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`残り ${Math.ceil(clamped)} 秒`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s linear' }}
        />
      </svg>
      <span
        className="absolute text-[11px] font-extrabold tabular-nums"
        style={{ color: expired ? '#f43f5e' : '#334155' }}
      >
        {expired ? '0' : Math.ceil(clamped)}
      </span>
    </span>
  );
}
