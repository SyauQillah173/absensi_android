export interface TabItem {
  id: string;
  label: string;
}

interface SegmentedTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}

export function SegmentedTabs({ tabs, active, onChange }: SegmentedTabsProps) {
  return (
    <div className="q-panel grid gap-2 p-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            className={`min-h-11 rounded-2xl px-4 text-sm font-bold transition ${
              selected ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/20' : 'text-[#636E72] hover:bg-white/70'
            }`}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
