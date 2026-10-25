/* Pictogramme SVG : mêmes tracés que l'ancien App.ic() (App.ICONS). */
export default function Icon({ name, cls }: { name: string; cls?: string }) {
  const icons = window.App.ICONS as Record<string, string>;
  return (
    <svg className={'ic ' + (cls || '')} viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name] || icons.file} />
    </svg>
  );
}
