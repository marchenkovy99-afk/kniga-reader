import Hypher from 'hypher';
import russian from 'hyphenation.ru';

const dictionary=new Hypher(russian),cache=new Map();
/** Break opportunities only: no inserted characters in the source or anchors. */
export function russianHyphenOffsets(word){
 if(!/^[А-ЯЁа-яё]{6,80}$/.test(word))return [];
 const key=word.toLowerCase();
 if(cache.has(key))return cache.get(key);
 let at=0;
 const offsets=dictionary.hyphenate(key).slice(0,-1).map(part=>at+=part.length)
  .filter(offset=>offset>=2&&word.length-offset>=2);
 if(cache.size>=10000)cache.delete(cache.keys().next().value);
 cache.set(key,offsets);
 return offsets;
}
