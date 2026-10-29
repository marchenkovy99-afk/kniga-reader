import type { SVGProps } from 'react';
type IconName='plus'|'search'|'book'|'bookmark'|'settings'|'back'|'list'|'type'|'more'|'check'|'trash'|'close'|'sun'|'cloud';
export function Icon({name,size=22,...props}:{name:IconName,size?:number}&SVGProps<SVGSVGElement>){
 const paths:Record<IconName,React.ReactNode>={
 plus:<path d="M12 5v14M5 12h14"/>,search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
 book:<><path d="M4 5.8C8 4.5 10.5 5 12 7c1.5-2 4-2.5 8-1.2v13.5c-3.5-1-6.2-.6-8 1.1-1.8-1.7-4.5-2.1-8-1.1z"/><path d="M12 7v13.4"/></>,
 bookmark:<path d="M6.5 4.5h11v16l-5.5-4-5.5 4z"/>,
 settings:<><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--bg)"/><circle cx="15" cy="12" r="2" fill="var(--bg)"/><circle cx="10" cy="17" r="2" fill="var(--bg)"/></>,
 back:<path d="m14.5 5-7 7 7 7"/>,
 list:<><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></>,
 type:<><path d="M3 7h13M9.5 7v13M6.5 20h6M16 11h6M19 11v9M17 20h4"/></>,
 more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
 check:<path d="m4 12 5 5L20 6"/>,trash:<><path d="M4 7h16M8 7V4h8v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></>,
 close:<path d="M5 5l14 14M19 5 5 19"/>,
 sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></>,
 cloud:<><path d="M7 18a5 5 0 0 1-.2-10 6.5 6.5 0 0 1 12.2 2A4 4 0 0 1 18 18z"/></>
 };
 return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
