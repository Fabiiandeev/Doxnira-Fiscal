import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import { createPurchase, receivePurchase, transitionPurchase } from "../../src/modules/operation/purchase.service.js";
import { createSale, invoiceSale, reserveSale, returnSale, transitionSale } from "../../src/modules/operation/sales.service.js";

after(disconnectDatabase);
test("compras e vendas integram estoque e financeiro com idempotência", async () => {
  process.env.FISCAL_PROVIDER_CONFIGURED = "true";
  const fixture = randomUUID().replaceAll("-", "");
  const user = await prisma.user.create({ data: { name: "Operation 08B", email: `operation-${fixture}@test.invalid`, passwordHash: "test" } });
  const company = await prisma.company.create({ data: { ownerId: user.id, legalName: "Operation 08B", cnpj: fixture.slice(0, 14) } });
  const other = await prisma.company.create({ data: { ownerId: user.id, legalName: "Other 08B", cnpj: fixture.slice(14, 28) } });
  try {
    const warehouse = await prisma.warehouse.create({ data: { companyId: company.id, code: "MAIN", name: "Principal", isDefault: true } });
    const product = await prisma.product.create({ data: { companyId: company.id, code: `P-${fixture}`, name: "Produto 08B", price: 20 } });
    const supplier = await prisma.fornecedor.create({ data: { companyId: company.id, tipoPessoa: "PJ", razaoSocial: "Fornecedor 08B", cnpj: fixture.slice(0, 14) } });
    const foreignSupplier = await prisma.fornecedor.create({ data: { companyId: other.id, tipoPessoa: "PJ", razaoSocial: "Foreign", cnpj: fixture.slice(14, 28) } });
    const client = await prisma.client.create({ data: { ownerId: user.id, companyId: company.id, tipoPessoa: "PJ", razaoSocial: "Cliente 08B", cnpj: fixture.slice(0, 14) } });
    const purchaseInput = { number: `PC-${fixture}`, supplierId: supplier.id, warehouseId: warehouse.id, issueDate: new Date(), totalAmount: 50, freightAmount: 0, discountAmount: 0, taxAmount: 0, installments: [{ number: "1", dueDate: new Date(), amount: 50 }], attachments: [], items: [{ productId: product.id, quantity: 10, unitValue: 5, discountAmount: 0, taxAmount: 0 }] };
    await assert.rejects(() => createPurchase(company.id, user.id, { ...purchaseInput, number: "FOREIGN", supplierId: foreignSupplier.id }), /não encontrado/);
    const purchase = await createPurchase(company.id, user.id, purchaseInput);
    await transitionPurchase(company.id, purchase.id, "submit"); await transitionPurchase(company.id, purchase.id, "approve");
    const partial = await receivePurchase(company.id, user.id, purchase.id, { idempotencyKey: `receipt-1:${fixture}`, confirmExcess: false, items: [{ purchaseOrderItemId: purchase.items[0].id, quantity: 4 }] });
    assert.equal((await receivePurchase(company.id, user.id, purchase.id, { idempotencyKey: `receipt-1:${fixture}`, confirmExcess: false, items: [{ purchaseOrderItemId: purchase.items[0].id, quantity: 4 }] })).id, partial.id);
    await receivePurchase(company.id, user.id, purchase.id, { idempotencyKey: `receipt-2:${fixture}`, confirmExcess: false, items: [{ purchaseOrderItemId: purchase.items[0].id, quantity: 6 }] });
    assert.equal((await prisma.inventoryBalance.findUnique({ where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } } })).physicalQuantity.toString(), "10");
    assert.equal(await prisma.payable.count({ where: { companyId: company.id, externalKey: `purchase:${purchase.id}` } }), 1);
    const saleInput = { number: `PV-${fixture}`, origin: "MANUAL", externalKey: `sale:${fixture}`, clientId: client.id, warehouseId: warehouse.id, issueDate: new Date(), totalAmount: 40, freightAmount: 0, discountAmount: 0, taxAmount: 0, items: [{ productId: product.id, quantity: 2, unitValue: 20, discountAmount: 0, taxAmount: 0 }] };
    const sale = await createSale(company.id, user.id, saleInput);
    await assert.rejects(() => createSale(company.id, user.id, { ...saleInput, number: `PV2-${fixture}` }));
    await transitionSale(company.id, sale.id, "submit"); await transitionSale(company.id, sale.id, "approve"); await reserveSale(company.id, sale.id);
    const allocation = await invoiceSale(company.id, user.id, sale.id, { documentType: "NFE", idempotencyKey: `invoice:${fixture}`, items: [{ salesOrderItemId: sale.items[0].id, quantity: 2 }] });
    assert.equal((await invoiceSale(company.id, user.id, sale.id, { documentType: "NFE", idempotencyKey: `invoice:${fixture}`, items: [{ salesOrderItemId: sale.items[0].id, quantity: 2 }] })).id, allocation.id);
    assert.equal(await prisma.receivable.count({ where: { companyId: company.id, externalKey: `sales-invoice:${allocation.id}` } }), 1);
    const returned = await returnSale(company.id, user.id, sale.id, { reason: "Cliente devolveu", idempotencyKey: `return:${fixture}`, adjustFinancial: true, items: [{ salesOrderItemId: sale.items[0].id, quantity: 1 }] });
    assert.equal(returned.items.length, 1);
    assert.equal((await prisma.inventoryBalance.findUnique({ where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } } })).physicalQuantity.toString(), "9");
  } finally {
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [company.id, other.id] } } });
    await prisma.salesReturnItem.deleteMany({ where: { companyId: company.id } }); await prisma.salesReturn.deleteMany({ where: { companyId: company.id } });
    await prisma.receivable.deleteMany({ where: { companyId: company.id } }); await prisma.salesInvoiceAllocation.deleteMany({ where: { companyId: company.id } });
    await prisma.inventoryReservation.deleteMany({ where: { companyId: company.id } }); await prisma.salesOrderItem.deleteMany({ where: { companyId: company.id } }); await prisma.salesOrder.deleteMany({ where: { companyId: company.id } });
    await prisma.payable.deleteMany({ where: { companyId: company.id } }); await prisma.purchaseReceiptItem.deleteMany({ where: { companyId: company.id } }); await prisma.purchaseReceipt.deleteMany({ where: { companyId: company.id } });
    await prisma.inventoryMovement.deleteMany({ where: { companyId: company.id } }); await prisma.inventoryBalance.deleteMany({ where: { companyId: company.id } });
    await prisma.purchaseOrderItem.deleteMany({ where: { companyId: company.id } }); await prisma.purchaseOrder.deleteMany({ where: { companyId: company.id } });
    await prisma.client.deleteMany({ where: { companyId: company.id } }); await prisma.fornecedor.deleteMany({ where: { companyId: { in: [company.id, other.id] } } });
    await prisma.product.deleteMany({ where: { companyId: company.id } }); await prisma.warehouse.deleteMany({ where: { companyId: company.id } });
    await prisma.company.deleteMany({ where: { id: { in: [company.id, other.id] } } }); await prisma.user.delete({ where: { id: user.id } });
  }
});
