import type { CSSProperties } from 'react';

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
    <div className="q-panel q-segmented-tabs p-2" style={{ '--tab-count': tabs.length } as CSSProperties}>
      <div className="q-segmented-scroll q-scrollbar">
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
    </div>
  );
}
