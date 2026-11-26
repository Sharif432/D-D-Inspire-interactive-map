import { createCampaignApp } from "./_app.js";

const app = createCampaignApp({
  websocketEnabled: false
});

export default function handler(req: any, res: any) {
  try {
    const rawUrl = typeof req?.url === "string" && req.url.length > 0 ? req.url : "/api";
    const urlObj = new URL(rawUrl, "http://localhost");
    const searchPaths = urlObj.searchParams.getAll("__path");
    const queryPath = req?.query?.__path;
    const rawPath =
      searchPaths.length > 0
        ? searchPaths.join("/")
        : queryPath !== undefined
          ? Array.isArray(queryPath)
            ? queryPath.join("/")
            : String(queryPath)
          : undefined;

    if (rawPath !== undefined) {
      urlObj.searchParams.delete("__path");
      const qs = urlObj.searchParams.toString();
      const cleaned = rawPath.replace(/^\/+/, "");
      req.url = cleaned ? `/api/${cleaned}${qs ? `?${qs}` : ""}` : `/api${qs ? `?${qs}` : ""}`;
    } else if (!urlObj.pathname.startsWith("/api")) {
      const qs = urlObj.searchParams.toString();
      const suffix = urlObj.pathname === "/" ? "/health" : urlObj.pathname;
      req.url = `/api${suffix}${qs ? `?${qs}` : ""}`;
    }

    return app(req, res);
  } catch (err: any) {
    console.error("Vercel API handler error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          success: false,
          error: err?.message || "Serverless API initialization failed"
        })
      );
    }
  }
}
