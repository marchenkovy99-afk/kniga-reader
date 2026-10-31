import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const node=document.getElementById('root');
if(!node)throw new Error('LIBRA root missing');
createRoot(node).render(<StrictMode><App/></StrictMode>);
if('serviceWorker' in navigator&&import.meta.env.PROD){
  // Installed iPhone apps have their own persistent service worker. A stale
  // controller must not keep serving a prior release with the old reader code.
  const workerUrl=import.meta.env.BASE_URL+'sw.js?rev=13';
  let controlled=Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    const current=navigator.serviceWorker.controller?.scriptURL;
    if(!current)return;
    if(!controlled){controlled=true;return}
    const key='libra-sw-reloaded-controller';
    try{
      if(sessionStorage.getItem(key)===current)return;
      sessionStorage.setItem(key,current);
    }catch{}
    if(document.visibilityState==='visible')location.reload();
  });
  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register(workerUrl,{
      scope:import.meta.env.BASE_URL,updateViaCache:'none'
    }).then(registration=>{
      void registration.update();
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible')void registration.update();
      });
    }).catch(error=>console.warn('LIBRA service worker update failed',error));
  });
}
