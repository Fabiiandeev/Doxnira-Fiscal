export function certificateStatus(certificate) {
  if (!certificate) return "NOT_CONFIGURED";
  if (certificate.status === "revoked") return "REVOKED";
  if (!certificate.validUntil) return "INVALID";
  const daysRemaining = Math.ceil((new Date(certificate.validUntil).getTime() - Date.now()) / 86400000);
  return daysRemaining < 0 ? "EXPIRED" : daysRemaining <= 30 ? "EXPIRING" : "VALID";
}
export function certificateSummary(certificate) {
  const status = certificateStatus(certificate);
  return certificate ? { ...certificate, status, daysRemaining: certificate.validUntil ? Math.ceil((new Date(certificate.validUntil).getTime() - Date.now()) / 86400000) : null } : { status, daysRemaining: null };
}
