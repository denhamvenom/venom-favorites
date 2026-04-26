export type Tab = 'schedule' | 'results';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="flex gap-1 px-4 pt-2 pb-2 border-b border-neutral-900 bg-neutral-950 sticky top-[68px] z-10">
      <TabButton active={active === 'schedule'} onClick={() => onChange('schedule')}>
        Schedule
      </TabButton>
      <TabButton active={active === 'results'} onClick={() => onChange('results')}>
        Results
      </TabButton>
    </nav>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls = active
    ? 'bg-purple text-white'
    : 'bg-transparent text-neutral-400 hover:text-neutral-100';
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}
