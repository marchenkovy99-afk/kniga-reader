import base from './playwright.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,testIgnore:[],testMatch:'**/pwa-illustrations.spec.ts',use:{...base.use,baseURL:'http://127.0.0.1:4174'},webServer:{command:'npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',url:'http://127.0.0.1:4174',reuseExistingServer:false,timeout:60000}});
