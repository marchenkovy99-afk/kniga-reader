export const defaults = Object.freeze({fontSize:22,lineHeight:1.55,margin:24,paragraphGap:0.7,indent:1.3,letterSpacing:0,font:'serif',theme:'paper',align:'left',hyphens:true,animation:true});
export function clampSettings(input={}) {
 const s={...defaults};
 for(const [key,min,max] of [['fontSize',12,48],['lineHeight',1,2.5],['margin',8,72],['paragraphGap',0,2],['indent',0,3],['letterSpacing',-0.5,3]]) {
  const n=Number(input[key]); if(Number.isFinite(n)) s[key]=Math.min(max,Math.max(min,n));
 }
 for(const [key,allowed] of [['font',['serif','literary','sans']],['theme',['paper','white','night']],['align',['left','justify']]]) if(allowed.includes(input[key]))s[key]=input[key];
 for(const key of ['hyphens','animation'])if(typeof input[key]==='boolean')s[key]=input[key];
 return s;
}
export function compareAnchors(a,b){return a.block-b.block||a.offset-b.offset;}
export function pageForAnchor(pages,anchor={block:0,offset:0}) {
 let result=0;
 for(let i=0;i<pages.length;i++){if(compareAnchors(pages[i].start,anchor)<=0) result=i; else break;}
 return result;
}
