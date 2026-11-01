import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import {prepareOffline} from './offline';

const node=document.getElementById('root');
if(!node)throw new Error('LIBRA root missing');
createRoot(node).render(<StrictMode><App/></StrictMode>);
if('serviceWorker' in navigator&&import.meta.env.PROD){
  const prepare=()=>{void prepareOffline().catch(error=>console.warn('Libra offline:',error))};
  prepare();
  window.addEventListener('online',prepare);
}
