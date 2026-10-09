// Temporary Phase 1 token check. Replaced by the real homepage in Phase 4.
// Every class below is a complete literal string, so Tailwind's scanner sees it.
const swatches = [
  { name: "ivory", classes: "bg-ivory text-ink" },
  { name: "sand", classes: "bg-sand text-ink" },
  { name: "cedar", classes: "bg-cedar text-ivory" },
  { name: "gold", classes: "bg-gold text-ink" },
  { name: "ink", classes: "bg-ink text-ivory" },
  { name: "hairline", classes: "bg-hairline text-ink" },
] as const;

export default function TokenCheck() {
  return (
    <main className="section-y">
      <div className="page-container">
        <h1 className="text-4xl font-bold md:text-5xl">بلدية بشتفين</h1>
        <p className="mt-4">
          نص تجريبي للتحقق من الخط والمقاس وارتفاع السطر. Bshatfine Municipality.
        </p>
        <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
          {swatches.map((s) => (
            <li
              key={s.name}
              className={`${s.classes} rounded-card border border-hairline p-6 text-base`}
            >
              {s.name}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
