import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
test('startup migration does not turn normalizing old spacing into a new font edit',()=>{
 const init=source.slice(source.indexOf('async function init()'));
 assert.ok(init.includes('if(storedSettings&&storedSettings.paragraphSpacingVersion!==1)'));
 assert.ok(!init.includes('settingsUpdatedAt=Date.now()'));
 assert.ok(init.includes("b.appearanceUpdatedAt=legacyAppearanceTimestamp(b.progress)"));
});
