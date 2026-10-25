import { notFound } from 'next/navigation';
import { PAGE_KEYS } from '@/lib/pages';

/* Route d'un écran (/ventes, /paie-periode…). Le rendu est assuré par la coque du layout ; ici : validation de l'URL. */
export const dynamicParams = false;

export function generateStaticParams() {
  return PAGE_KEYS.map((page) => ({ page }));
}

export default async function ScreenRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!(PAGE_KEYS as readonly string[]).includes(page)) notFound();
  return null;
}
