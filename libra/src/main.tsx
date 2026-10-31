import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const node=document.getElementById('root');
if(!node)throw new Error('LIBRA root missing');
createRoot(node).render(<StrictMode><App/></StrictMode>);
if('serviceWorker' in navigator&&import.meta.env.PROD){
  window.addEventListener('load',()=>{void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL})});
}
