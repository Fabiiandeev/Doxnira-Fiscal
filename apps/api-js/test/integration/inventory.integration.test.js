import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { adjustInventory, completeCount, completeTransfer, createCount, createReservation, createTransfer, transitionReservation } from "../../src/modules/operation/inventory.service.js";

after(disconnectDatabase);
test("estoque integra saldo, reserva, transferência, inventário, rollback e isolamento", async () => {
  const fixture = randomUUID();
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database, current_user AS user_name, current_schema() AS schema_name`;
  assert.deepEqual(identity, { database: "ns_fiscal_cloud_test", user_name: "ns_fiscal_app", schema_name: "public" });
  const user = await prisma.user.create({ data: { name: "Inventory Test", email: `inventory-${fixture}@test.invalid`, passwordHash: "test" } });
  const company = await prisma.company.create({ data: { ownerId: user.id, legalName: "Inventory Test", cnpj: fixture.replaceAll("-", "").slice(0, 14) } });
  const other = await prisma.company.create({ data: { ownerId: user.id, legalName: "Other Inventory", cnpj: fixture.replaceAll("-", "").slice(14, 28) } });
  try {
    const [source, destination] = await Promise.all([
      prisma.warehouse.create({ data: { companyId: company.id, code: "A", name: "Origem", isDefault: true } }),
      prisma.warehouse.create({ data: { companyId: company.id, code: "B", name: "Destino" } }),
    ]);
    const product = await prisma.product.create({ data: { companyId: company.id, code: `P-${fixture}`, name: "Produto", price: 10 } });
    const input = { warehouseId: source.id, productId: product.id, quantity: 10, unitCost: 5, reason: "Saldo inicial", idempotencyKey: `entry:${fixture}` };
    const entry = await adjustInventory(company.id, user.id, input);
    assert.equal(Number(entry.resultingQuantity), 10);
    assert.equal((await adjustInventory(company.id, user.id, input)).id, entry.id);
    const reservation = await createReservation(company.id, { warehouseId: source.id, productId: product.id, quantity: 2, sourceType: "TEST", externalKey: `reservation:${fixture}` });
    await transitionReservation(company.id, user.id, reservation.id, "release");
    const transfer = await createTransfer(company.id, user.id, { sourceWarehouseId: source.id, destinationWarehouseId: destination.id, reason: "Teste", items: [{ productId: product.id, quantity: 3 }] });
    await completeTransfer(company.id, user.id, transfer.id);
    await assert.rejects(() => completeTransfer(company.id, user.id, transfer.id), /finalizada/);
    const count = await createCount(company.id, user.id, { warehouseId: destination.id, notes: "Contagem" });
    await prisma.inventoryCountItem.update({ where: { id: count.items[0].id }, data: { countedQuantity: 4, differenceQuantity: 1 } });
    await completeCount(company.id, user.id, count.id);
    await assert.rejects(() => completeCount(company.id, user.id, count.id), /finalizado/);
    assert.equal(await prisma.warehouse.count({ where: { companyId: other.id } }), 0);
    await assert.rejects(() => adjustInventory(other.id, user.id, { ...input, idempotencyKey: `cross:${fixture}` }), /não encontrado/);
    const before = await prisma.inventoryBalance.findUnique({ where: { warehouseId_productId: { warehouseId: source.id, productId: product.id } } });
    await assert.rejects(async () => {
      const invalid = await createTransfer(company.id, user.id, { sourceWarehouseId: source.id, destinationWarehouseId: destination.id, items: [{ productId: product.id, quantity: 999 }] });
      await completeTransfer(company.id, user.id, invalid.id);
    }, /insuficiente/i);
    const afterRollback = await prisma.inventoryBalance.findUnique({ where: { id: before.id } });
    assert.equal(afterRollback.physicalQuantity.toString(), before.physicalQuantity.toString());
  } finally {
    await prisma.inventoryCountItem.deleteMany({ where: { companyId: company.id } });
    await prisma.inventoryCount.deleteMany({ where: { companyId: company.id } });
    await prisma.inventoryMovement.deleteMany({ where: { companyId: company.id } });
    await prisma.inventoryTransferItem.deleteMany({ where: { companyId: company.id } });
    await prisma.inventoryTransfer.deleteMany({ where: { companyId: company.id } });
    await prisma.inventoryReservation.deleteMany({ where: { companyId: company.id } });
    await prisma.inventoryBalance.deleteMany({ where: { companyId: company.id } });
    await prisma.warehouse.deleteMany({ where: { companyId: company.id } });
    await prisma.product.deleteMany({ where: { companyId: company.id } });
    await prisma.company.deleteMany({ where: { id: { in: [company.id, other.id] } } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
