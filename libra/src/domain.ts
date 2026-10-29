export type Format = 'fb2' | 'epub' | 'pdf';
export type ThemeName = 'paper' | 'white' | 'night' | 'oled';
export type ReaderSettings = {
  theme: ThemeName;
  fontSize: number;
  lineHeight: number;
  margin: number;
  paragraphIndent: number;
  fontFamily: 'serif' | 'sans';
  align: 'justify' | 'left';
  animation: 'none' | 'slide';
};
export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'paper', fontSize: 18, lineHeight: 1.45,
  margin: 20, paragraphIndent: 1.2,
  fontFamily: 'serif', align: 'justify', animation: 'slide'
};
export type ReaderPosition = {
  chapter: number;
  page: number;
  fraction: number;
  cfi?: string;
  anchor?: import('./anchors').FB2Anchor;
  updatedAt: number;
};
export type TextBlock = { kind: 'paragraph' | 'heading' | 'verse'; text: string };
export type ImageBlock = { kind: 'image'; src: string; alt: string };
export type TableBlock = { kind: 'table'; rows: string[][] };
export type Block = TextBlock | ImageBlock | TableBlock;
export type Chapter = { id: string; title: string; blocks: Block[] };
export type ParsedFB2 = { title: string; author: string; cover?: string; chapters: Chapter[]; fullText: string };
export type StoredBook = {
  id: string; filename: string; title: string; author: string; format: Format;
  file: Blob; cover?: string; importedAt: number; position?: ReaderPosition;
  lastOpenedAt?: number; bookmarks: ReaderPosition[];
};
