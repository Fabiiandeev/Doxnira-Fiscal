export async function listUserAccess(prisma, company) {
  const owner = await prisma.user.findUnique({ where: { id: company.ownerId }, select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true } });
  return owner ? [{ ...owner, status: "ACTIVE", companies: [company.id], permissions: ["*"] }] : [];
}
