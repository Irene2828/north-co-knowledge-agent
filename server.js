import http from "node:http";
import { createServer } from "vite";
import run from "./api/run.js";
import status from "./api/status.js";
const vite = await createServer({ server: { middlewareMode: true } });
http
  .createServer(async (req, res) => {
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (o) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(o));
    };
    if (req.url === "/api/status") return status(req, res);
    if (req.url === "/api/run") {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096)
          return res.status(413).json({ error: "Question is too long." });
      }
      try {
        req.body = JSON.parse(body || "{}");
      } catch {
        return res.status(400).json({ error: "Invalid JSON." });
      }
      return run(req, res);
    }
    vite.middlewares(req, res);
  })
  .listen(3000, "0.0.0.0", () =>
    console.log("North & Co. http://localhost:3000"),
  );
