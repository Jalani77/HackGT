import { Link } from 'react-router-dom';
import type { StudentSummary } from '@shared/types';

const PALETTE = ['#7cf5c8', '#ffd166', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c'];

export function Avatar({ student, size = 40 }: { student: Pick<StudentSummary, 'displayName' | 'username'>; size?: number }) {
  // Stable color per username so people are recognizable across screens.
  const hash = [...student.username].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl font-display font-bold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.45, background: PALETTE[hash % PALETTE.length] }}
    >
      {student.displayName[0]?.toUpperCase()}
    </div>
  );
}

/** Compact, tappable student link → their profile. */
export function StudentChip({ student, extra }: { student: StudentSummary; extra?: string }) {
  return (
    <Link
      to={`/profile/${student.id}`}
      className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 ring-1 ring-white/10 active:scale-95"
    >
      <Avatar student={student} size={26} />
      <span className="text-sm font-semibold">{student.displayName}</span>
      <span className="text-[11px] text-white/45">{extra ?? `Lv ${student.level}`}</span>
    </Link>
  );
}
