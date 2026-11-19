import type { MetadataRoute } from "next";
import { clientRecordGuidePath, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", clientRecordGuidePath].map((path) => ({
    url: new URL(path, siteUrl).href,
  }));
}
