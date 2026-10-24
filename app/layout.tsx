import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Книга · личная читалка',description:'Личная библиотека FB2 и EPUB с гибкими настройками текста и облачной синхронизацией.',icons:{icon:'/reader/icon-192.png?v=2'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>;}
