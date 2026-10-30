import type { ThemeName } from './domain';
export const PALETTES: Record<ThemeName,{background:string;text:string;muted:string;border:string;accent:string;status:'default'|'black-translucent'}>={
  paper:{background:'#F7F4EF',text:'#262522',muted:'#76716B',border:'#E7E1D9',accent:'#B65B35',status:'default'},
  white:{background:'#FFFFFF',text:'#242824',muted:'#737973',border:'#E5E8E5',accent:'#8B6044',status:'default'},
  night:{background:'#1D1F1E',text:'#F2F0E9',muted:'#9DA29E',border:'#3E423F',accent:'#D4AD8B',status:'black-translucent'},
  oled:{background:'#000000',text:'#F2F2EF',muted:'#979797',border:'#333333',accent:'#D7B494',status:'black-translucent'}
};
export function setTheme(theme:ThemeName){
  const colors=PALETTES[theme];
  const root=document.documentElement;
  root.dataset.theme=theme;
  root.style.setProperty('--bg',colors.background);
  root.style.setProperty('--fg',colors.text);
  root.style.setProperty('--muted',colors.muted);
  root.style.setProperty('--border',colors.border);
  root.style.setProperty('--accent',colors.accent);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',colors.background);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content',colors.status);
}
