export function epubFixture(complex=false,title='EPUB fixture',paragraphCount=140,clipped=false,publisherJustified=false):Buffer{
 const chapterParagraphs=Array.from({length:paragraphCount},(_,i)=>
  '<p'+(clipped&&i===0?' style="height:10px;overflow:hidden"':'')+'>Passage '+i+' '+('The complete book remains visible after typography changes. '.repeat(7))+'</p>').join('');
 const files=[
  ['mimetype','application/epub+zip'],
  ['META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
  ['OEBPS/content.opf','<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>EPUB fixture</dc:title><dc:identifier id="uid">urn:uuid:aa-bb-cc</dc:identifier><dc:language>en</dc:language></metadata><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx"><itemref idref="c1"/></spine></package>'],
  ['OEBPS/toc.ncx','<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:aa-bb-cc"/></head><docTitle><text>EPUB fixture</text></docTitle><navMap><navPoint id="one" playOrder="1"><navLabel><text>Opening</text></navLabel><content src="one.xhtml"/></navPoint></navMap></ncx>'],
  ['OEBPS/one.xhtml','<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Opening</title></head><body><h1>FIRST CHAPTER</h1>'+chapterParagraphs+'<p>END OF BOOK</p></body></html>']
 ];

 if(publisherJustified){
  const xhtml=files.find(x=>x[0]==='OEBPS/one.xhtml')!;
  xhtml[1]=xhtml[1]
    .replace('</head>', '<style type="text/css">p {text-align:justify!important;word-spacing:21px!important} span {word-spacing:13px!important}</style></head>')
    .replace('<p>Passage 0 ', '<p style="text-align:justify!important;word-spacing:18px!important">Passage 0 ');
 }
 if(complex){
  const opf=files.find(x=>x[0]==='OEBPS/content.opf')!;
  opf[1]=opf[1]
   .replace('</manifest>','<item id="c2" href="second.xhtml" media-type="application/xhtml+xml"/></manifest>')
   .replace('</spine>','<itemref idref="c2"/></spine>');
  const ncx=files.find(x=>x[0]==='OEBPS/toc.ncx')!;
  ncx[1]=ncx[1].replace('</navMap>','<navPoint id="two" playOrder="2"><navLabel><text>Вторая глава</text></navLabel><content src="second.xhtml"/></navPoint></navMap>');
  const pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==';
  files.push(['OEBPS/second.xhtml',
   '<?xml version="1.0" encoding="UTF-8"?>'+
   '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Вторая глава</title></head><body>'+
   '<h1>SECOND CHAPTER</h1>'+
   '<p>Тестируем изображения и широкую таблицу, сохранение всех символов.</p>'+
   '<table><tbody><tr><td>LEFT CELL</td><td>EXTREMELY_LONG_UNBREAKABLE_CELL_VALUE_123456789_987654321</td></tr></tbody></table>'+
   '<p><img alt="Тестовая иллюстрация" src="data:image/png;base64,'+pixel+'"/></p>'+
   '<p>END OF SECOND CHAPTER</p></body></html>']);
 }
 for(const file of files)file[1]=file[1].replaceAll('EPUB fixture',title);
 const crc32=(buffer:Buffer)=>{
  let crc=0xffffffff;
  for(const b of buffer){
   crc^=b;
   for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
 };
 const chunks:Buffer[]=[];const central:Buffer[]=[];let offset=0;
 for(const [path,text] of files){
  const name=Buffer.from(path,'utf8'),body=Buffer.from(text,'utf8');
  const crc=crc32(body);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);
  local.writeUInt32LE(body.length,22);local.writeUInt16LE(name.length,26);
  chunks.push(local,name,body);
  const entry=Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);
  entry.writeUInt16LE(20,6);entry.writeUInt32LE(crc,16);
  entry.writeUInt32LE(body.length,20);entry.writeUInt32LE(body.length,24);
  entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
  central.push(entry,name);
  offset+=local.length+name.length+body.length;
 }
 const centralSize=central.reduce((total,part)=>total+part.length,0);
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);
 end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralSize,12);
 end.writeUInt32LE(offset,16);
 return Buffer.concat([...chunks,...central,end]);
}
