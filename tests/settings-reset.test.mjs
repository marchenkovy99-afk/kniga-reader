import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {defaults} from '../reader/src/anchors.js';
import {resetAppearanceSection} from '../reader/src/ui-model.js';
const source=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
function runReset(selector,tab){
 const handler=source.match(new RegExp("document\\.querySelector\\('"+selector+"'\\)\\.onclick=\\(\\)=>\\{([^\\n]+)\\};"))[1];
 const state={settings:{...defaults,fontSize:31,margin:60,theme:'oled'},defaults,settingsTab:tab,resetAppearanceSection,current:{id:'sample'},theme(){},saveSettings(){},showSettings(){},scheduleLayout(){}};
 vm.runInNewContext(handler,state);return state.settings;
}
test('page reset preserves font and theme in an open book',()=>{
 const settings=runReset('#reset-settings','page');assert.equal(settings.fontSize,31);assert.equal(settings.margin,24);assert.equal(settings.theme,'oled');
});
test('explicit full reset restores all appearance defaults',()=>{
 assert.deepEqual({...runReset('#reset-all-settings','page')},defaults);
});
