import test from 'node:test';
import assert from 'node:assert/strict';
import {pageTurnMotion} from '../reader/src/page-turn.js';
import {restoreSettings} from '../reader/src/anchors.js';
test('all page transitions stay instant despite old cloud animation settings',()=>{
 for(const animation of [true,false,undefined])for(const reduced of [true,false]){
  const motion=pageTurnMotion({animation},reduced);
  assert.equal(motion.animate,false);assert.equal(motion.flippingTime,0);
  assert.equal(restoreSettings({animation}).animation,false);
 }
});
