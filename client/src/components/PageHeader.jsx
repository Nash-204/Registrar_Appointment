export const Eyebrow = ({ children, dark }) => (
  <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] ${dark ? 'text-seal' : 'text-sealdark'}`}>
    <span className={`h-0.5 w-8 ${dark ? 'bg-seal' : 'bg-sealdark'}`} />
    {children}
  </p>
);

// Navy heading band shared by the booking and tracking pages.
export default function PageHeader({ eyebrow, title, children }) {
  return (
    <section className="relative overflow-hidden bg-navy-deep text-white">
      <div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border-[40px] border-white/5" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-16">
        <Eyebrow dark>{eyebrow}</Eyebrow>
        <h1 className="mt-4 text-3xl font-semibold !text-white md:text-5xl">{title}</h1>
        {children && <p className="mt-4 max-w-2xl leading-7 text-white/80">{children}</p>}
      </div>
    </section>
  );
}
