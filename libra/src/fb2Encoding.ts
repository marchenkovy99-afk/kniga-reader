/**
 * FictionBook XML is often encoded in Windows-1251. Blob.text() assumes UTF-8
 * and silently corrupts Cyrillic characters in those files.
 *
 * Decode the original bytes according to a BOM or the XML declaration before
 * passing a Unicode string to DOMParser. Reject undecodable bytes instead of
 * replacing characters with U+FFFD and pretending the book is complete.
 */
const BOM_UTF8=[0xef,0xbb,0xbf];
const BOM_UTF16LE=[0xff,0xfe];
const BOM_UTF16BE=[0xfe,0xff];

function startsWith(bytes:Uint8Array,signature:number[]):boolean{
 return bytes.length>=signature.length&&signature.every((value,i)=>bytes[i]===value);
}
function sniffEncoding(bytes:Uint8Array):string{
 if(startsWith(bytes,BOM_UTF8))return 'utf-8';
 if(startsWith(bytes,BOM_UTF16LE))return 'utf-16le';
 if(startsWith(bytes,BOM_UTF16BE))return 'utf-16be';
 // XML encoding detection without a BOM. XML's first characters are ASCII
 // even in Windows-1251 and KOI8-R. Handle UTF-16 when the high bytes are zero.
 if(bytes.length>=4&&bytes[0]===0x3c&&bytes[1]===0&&bytes[2]===0x3f&&bytes[3]===0)return 'utf-16le';
 if(bytes.length>=4&&bytes[0]===0&&bytes[1]===0x3c&&bytes[2]===0&&bytes[3]===0x3f)return 'utf-16be';
 const prefix=Array.from(bytes.subarray(0,512),n=>String.fromCharCode(n)).join('');
 const declaration=prefix.match(/^\s*<\?xml\b[^>]*\bencoding\s*=\s*(['"])([^'"]+)\1/i);
 return declaration?.[2]?.trim()||'utf-8';
}

export function decodeFB2(bytes:Uint8Array):string{
 const label=sniffEncoding(bytes);
 try{
  return new TextDecoder(label,{fatal:true}).decode(bytes);
 }catch(error){
  throw new Error('Не удалось прочитать кодировку FB2 ('+label+'). Проверьте файл.',{cause:error});
 }
}
export async function decodeFB2Blob(blob:Blob):Promise<string>{
 return decodeFB2(new Uint8Array(await blob.arrayBuffer()));
}
