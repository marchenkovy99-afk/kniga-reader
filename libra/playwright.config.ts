import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',
 timeout:45000,
 retries:process.env.CI?1:0,
 reporter:process.env.CI?'github':'list',
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'chromium-iphone',use:{...devices['iPhone 13'],browserName:'chromium'}},
  {name:'webkit-iphone',use:{...devices['iPhone 13'],browserName:'webkit'}}
 ],
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
  url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:60000}
});
