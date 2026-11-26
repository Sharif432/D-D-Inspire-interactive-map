import { createCampaignApp } from "../server/app";

const app = createCampaignApp({
  websocketEnabled: false
});

export default function handler(req: any, res: any) {
  try {
    const rawPath = req?.query?.__path;
    if (rawPath !== undefined) {
      const pathStr = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath);
      const urlObj = new URL(req.url || "/", "http://localhost");
      urlObj.searchParams.delete("__path");
      const qs = urlObj.searchParams.toString();
      const cleaned = pathStr.replace(/^\/+/, "");
      req.url = cleaned ? `/api/${cleaned}${qs ? `?${qs}` : ""}` : `/api${qs ? `?${qs}` : ""}`;
    } else if (!req.url || !req.url.startsWith("/api")) {
      const prefix = req.url?.startsWith("/") ? req.url : `/${req.url || ""}`;
      req.url = `/api${prefix === "/" ? "/health" : prefix}`;
    }
  } catch {
    // Keep original req.url on parse fallback
  }

  return app(req, res);
}
