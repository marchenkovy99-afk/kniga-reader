declare module 'epubjs' {
  const ePub: (data: ArrayBuffer|Blob|string,options?:Record<string,unknown>)=>any;
  export default ePub;
}
