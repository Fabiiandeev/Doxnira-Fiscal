export function sanitizeXml(xml = "") {
  return String(xml)
    .replace(/<senha>[\s\S]*?<\/senha>/gi, "<senha>[REDACTED]</senha>")
    .replace(/<password>[\s\S]*?<\/password>/gi, "<password>[REDACTED]</password>")
    .replace(/<infAdic>[\s\S]*?<\/infAdic>/gi, "<infAdic>[REDACTED]</infAdic>")
    .slice(0, 500_000);
}
