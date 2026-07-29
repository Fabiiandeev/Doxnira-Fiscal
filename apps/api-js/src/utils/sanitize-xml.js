export function sanitizeXml(xml = "") {
  return String(xml)
    .replace(/<!DOCTYPE[\s\S]*?(?:\]>)|<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!ENTITY[\s\S]*?>/gi, "")
    .replace(/&(?:[a-z][\w.-]*);/gi, "[BLOCKED_ENTITY]")
    .replace(/<senha>[\s\S]*?<\/senha>/gi, "<senha>[REDACTED]</senha>")
    .replace(/<password>[\s\S]*?<\/password>/gi, "<password>[REDACTED]</password>")
    .replace(/<infAdic>[\s\S]*?<\/infAdic>/gi, "<infAdic>[REDACTED]</infAdic>")
    .slice(0, 500_000);
}
