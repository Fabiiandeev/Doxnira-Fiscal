import { robotsContent } from "@/helpers/marketing-metadata";

export const dynamic = "force-static";

export function GET() {
  return new Response(robotsContent, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
