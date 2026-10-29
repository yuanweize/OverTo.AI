'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useSite } from './SiteProvider';
export function Brand() {
  const site = useSite();
  return <Link href="/" className="brand-lockup"><Image src={site.logoPath} width={36} height={36} alt="" unoptimized/><span>{site.siteName}</span></Link>;
}
