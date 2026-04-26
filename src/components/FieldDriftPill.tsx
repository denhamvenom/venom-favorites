import type { FieldDrift } from '../types/domain';

interface Props {
  drift: FieldDrift;
}

export default function FieldDriftPill({ drift }: Props) {
  const { field, driftSeconds, basedOn } = drift;
  const minutes = Math.round(driftSeconds / 60);
  let label = 'ON TIME';
  let cls = 'bg-feasible/20 text-feasible border-feasible/40';
  if (basedOn === 0) {
    label = 'no data';
    cls = 'bg-neutral-800 text-tie border-neutral-700';
  } else if (Math.abs(minutes) < 1) {
    label = 'ON TIME';
    cls = 'bg-feasible/20 text-feasible border-feasible/40';
  } else if (minutes > 0) {
    label = `+${minutes} min`;
    cls = minutes >= 5
      ? 'bg-loss/20 text-loss border-loss/40'
      : 'bg-tight/20 text-tight border-tight/40';
  } else {
    label = `${minutes} min`;
    cls = 'bg-tight/20 text-tight border-tight/40';
  }
  return (
    <span
      className={`inline-flex items-baseline gap-1 px-2 py-0.5 rounded-full border text-xs font-mono ${cls}`}
      title={`Based on ${basedOn} completed match${basedOn === 1 ? '' : 'es'}`}
    >
      <span className="uppercase tracking-wider not-italic">{field.slice(0, 3)}</span>
      <span>·</span>
      <span>{label}</span>
    </span>
  );
}
