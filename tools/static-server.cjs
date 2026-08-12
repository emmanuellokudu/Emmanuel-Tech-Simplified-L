const http = require("node:http");
const { readFile } = require("node:fs");
const { extname, join, normalize } = require("node:path");

const root = join(__dirname, "..");
const contentTypes = { ".css": "text/css", ".html": "text/html; charset=utf-8", ".js": "text/javascript" };

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = normalize(join(root, relativePath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.setHeader("Content-Type", contentTypes[extname(filePath)] || "application/octet-stream");
    response.end(data);
  });
}).listen(8088, "127.0.0.1");
