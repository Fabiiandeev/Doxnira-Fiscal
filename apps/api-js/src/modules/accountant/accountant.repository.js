export function createAccountantRepository(prisma) {
  return {
    listQueue: (where, page, pageSize) => Promise.all([
      prisma.accountantFiscalQueueItem.findMany({ where, orderBy: [{ priority: "asc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.accountantFiscalQueueItem.count({ where }),
    ]),
    findQueue: (officeId, id) => prisma.accountantFiscalQueueItem.findFirst({ where: { id, officeId } }),
    createQueue: (data) => prisma.accountantFiscalQueueItem.create({ data }),
    updateQueue: (officeId, id, data) => prisma.accountantFiscalQueueItem.update({ where: { id, officeId }, data }),
  };
}
