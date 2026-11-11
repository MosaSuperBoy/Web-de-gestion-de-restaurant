const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = process.cwd();
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }

  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.setHeader('Content-Type', contentTypes[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
}).listen(8765, '127.0.0.1', () => {
  console.log('Preview server ready at http://127.0.0.1:8765/');
});
