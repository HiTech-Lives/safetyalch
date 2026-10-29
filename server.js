// Plesk Node.js startup file. In Plesk: Application Startup File = server.js
// Run `npm run build` once before starting.
const { createServer } = require('http');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log('Safety Alchemist listening on ' + port);
  });
});
