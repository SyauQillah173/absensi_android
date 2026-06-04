interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-bold text-[#636E72]">Qomaruddin Admin Web</p>
        <h1 className="text-3xl font-extrabold text-[#2D3436]">{title}</h1>
      </section>
      <div className="q-panel p-6">
        <div className="q-card p-8 text-center">
          <p className="mx-auto max-w-xl text-sm font-semibold leading-7 text-[#636E72]">{description}</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#138F81]">Fondasi menu sudah siap untuk tahap berikutnya</p>
        </div>
      </div>
    </div>
  );
}
