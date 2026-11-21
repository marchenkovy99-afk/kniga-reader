type OpeningBook={opened:Promise<unknown>;ready:Promise<unknown>;on?:(event:string,handler:(error:unknown)=>void)=>void;off?:(event:string,handler:(error:unknown)=>void)=>void};

/** epub.js does not reject `opened` for every invalid ZIP/OPF. Observe its
 * explicit failure event too, and bound loading so the library stays usable. */
export function waitForEpub(book:OpeningBook,timeout=20000):Promise<void>{
 return new Promise((resolve,reject)=>{
  let finished=false;
  const cleanup=()=>{clearTimeout(timer);book.off?.('openFailed',fail)};
  const fail=(error:unknown)=>{
   if(finished)return;finished=true;cleanup();
   reject(new Error('Не удалось открыть EPUB: '+(error instanceof Error?error.message:String(error))));
  };
  const timer=setTimeout(()=>fail(new Error('файл повреждён или его обработка заняла слишком много времени')),timeout);
  book.on?.('openFailed',fail);
  void Promise.all([book.opened,book.ready]).then(()=>{if(!finished){finished=true;cleanup();resolve()}},fail);
 });
}
