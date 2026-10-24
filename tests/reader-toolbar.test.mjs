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
test('curl engine receives real swipes and does not double-handle the drag',()=>{
 assert.ok(reader.includes("pointerInput:['touch','pen','mouse']"));
 assert.ok(reader.includes('engineHandlesSwipes:true'));
});
test('word wraps preserve natural line endings',()=>{
 assert.ok(styles.includes('overflow-wrap:break-word;word-break:normal'));
 assert.ok(styles.includes('.book-text div.paragraph.page-continues:not(.verse){text-align-last:auto}'));
});

test('page number and total appear centered in the visible control panel, never over book text',()=>{
 assert.ok(reader.includes('id="reader-page-position" class="reader-page-position"'));
 assert.ok(reader.includes('document.querySelector(\'#reader-page-position\').textContent=`${pageIndex+1} из ${pages.length}`'));
 assert.ok(!reader.includes('id="reader-page-number"'));
 assert.ok(!styles.includes('.reader-page-number{'));
 assert.ok(styles.includes('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)'));
});
