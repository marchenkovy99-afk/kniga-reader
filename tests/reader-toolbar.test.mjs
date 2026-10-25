import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const reader=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../reader/src/style.css',import.meta.url),'utf8');
test('chapter status is shown in the reader toolbar, not the appearance sheet',()=>{
 assert.ok(reader.includes('id="reader-chapter-remaining"'));
 assert.ok(reader.includes("document.querySelector('#reader-chapter-remaining').textContent=chapterReadingStatus"));
 assert.ok(!reader.includes('settings-chapter-progress'));
});
test('reader owns navigation gestures while the engine renders programmatic curls',()=>{
 assert.ok(reader.includes("pointerInput:[]"));
 assert.ok(reader.includes("attachReaderChrome(document.querySelector('#book-stage'),turn,{canNavigate:()=>!selectionUI?.active});"));
 assert.ok(reader.includes('allowTouchScroll:false'));
});
test('word wraps preserve natural line endings',()=>{
 assert.ok(styles.includes('overflow-wrap:break-word;word-break:normal'));
 assert.ok(styles.includes('.book-text div.paragraph.page-continues:not(.verse){text-align-last:var(--text-align,left)}'));
});

test('page number and total appear centered in the visible control panel, never over book text',()=>{
 assert.ok(reader.includes('id="reader-page-position" class="reader-page-position"'));
 assert.ok(reader.includes('document.querySelector(\'#reader-page-position\').textContent=`${pageIndex+1} из ${pages.length}`'));
 assert.ok(!reader.includes('id="reader-page-number"'));
 assert.ok(!styles.includes('.reader-page-number{'));
 assert.ok(styles.includes('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)'));
});
