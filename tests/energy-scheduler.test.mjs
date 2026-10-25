import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function scheduleCloudPoll(){'),source.indexOf('function updateCloudStatus()'));
function schedule({reading=false,error=null,visible=true,online=true}={}){
 const delays=[];const context={cloudPoll:null,cloud:{user:{id:'owner'},error,sync:async()=>{}},current:reading?{}:null,document:{visibilityState:visible?'visible':'hidden'},navigator:{onLine:online},clearTimeout:()=>{},setTimeout:(_fn,delay)=>{delays.push(delay);return 1;}};
 vm.runInNewContext(code+'\nscheduleCloudPoll();',context);return delays;
}
test('full snapshot checks use a two-minute reading cadence and one-minute library cadence',()=>{
 assert.deepEqual(schedule({reading:true}),[120000]);assert.deepEqual(schedule(),[60000]);
});
test('background, offline and failed connections do not create periodic polling timers',()=>{
 assert.deepEqual(schedule({visible:false}),[]);assert.deepEqual(schedule({online:false}),[]);assert.deepEqual(schedule({error:Error('offline')}),[]);
});
