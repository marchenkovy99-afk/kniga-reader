// Test page only. Production worker deliberately serves the cached reader for
// every navigation; do not register it on this disposable QA route.
navigator.serviceWorker.register=()=>Promise.reject(new Error('QA route does not install the production worker'));
