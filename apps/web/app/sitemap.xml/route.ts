import { sitemapEntries } from "@/helpers/marketing-metadata";

export const dynamic = "force-static";

export function GET() {
  const last = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (entry) =>
      `  <url>\n    <loc>${entry.url}</loc>\n    <lastmod>${last}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority.toFixed(1)}</priority>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
