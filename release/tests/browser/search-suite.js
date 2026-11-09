const output=document.querySelector('#suite-output');
const timer=setInterval(()=>{
 const cases=[...document.querySelectorAll('iframe')].map(frame=>{
  try{const value=JSON.parse(frame.contentDocument.querySelector('#qa-output').textContent);return {format:frame.title,status:value.status,checks:value.results?.length,last:value.results?.at(-1),error:value.error};}
  catch{return {format:frame.title,status:'STARTING'};}
 });
 const status=cases.some(test=>test.status==='FAIL')?'FAIL':cases.every(test=>test.status==='PASS')?'PASS':'RUNNING';
 output.textContent=JSON.stringify({status,cases},null,2);
 if(status!=='RUNNING'){document.title=status+': Libra search regression suite';clearInterval(timer);}
},500);
