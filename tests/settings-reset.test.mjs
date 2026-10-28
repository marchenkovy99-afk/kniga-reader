import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {defaults} from '../reader/src/anchors.js';
test('reset restores defaults after editing settings in an open book',()=>{
 const source=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
 const handler=source.match(/document\.querySelector\('#reset-settings'\)\.onclick=\(\)=>\{([^\n]+)\};/)[1];
 const state={settings:{...defaults,fontSize:31,margin:60,theme:'oled'},globalSettings:{...defaults,fontSize:31,margin:60,theme:'oled'},defaults,current:{id:'sample'},theme(){},saveSettings(){},showSettings(){},layout(){}};
 vm.runInNewContext(handler,state);
 assert.equal(state.settings.fontSize,22);assert.equal(state.settings.margin,24);assert.equal(state.settings.theme,'paper');
});
