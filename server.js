const http = require("http");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const githubContributions = require("./api/github-contributions");
const credlyBadges = require("./api/credly-badges");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

const API_ROUTES = {
  "/api/github-contributions": githubContributions,
  "/api/credly-badges": credlyBadges,
};

function createResponseAdapter(res) {
  const adapter = {
    statusCode: 200,
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      adapter.statusCode = code;
      return adapter;
    },
    json(data) {
      if (!res.headersSent) {
        res.writeHead(adapter.statusCode, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify(data));
    },
  };
  return adapter;
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
  const filePath = path.join(ROOT, relativePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0];
  const handler = API_ROUTES[urlPath];

  if (handler) {
    await handler(req, createResponseAdapter(res));
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
  console.log("APIs: /api/credly-badges, /api/github-contributions");
  if (!process.env.GITHUB_TOKEN) {
    console.log("Note: set GITHUB_TOKEN in .env for the contributions heatmap");
  }
});
