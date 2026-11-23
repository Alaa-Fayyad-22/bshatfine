import type { MetadataRoute } from "next";

const siteUrl = process.env.SITE_URL ?? "https://bshatfine.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/ar/admin", "/en/admin", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}