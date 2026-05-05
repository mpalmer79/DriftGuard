export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-sentinel-panel border border-sentinel-border rounded-lg p-4 ${className}`}
    >
      {title && <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-3">{title}</h2>}
      {children}
    </section>
  );
}
