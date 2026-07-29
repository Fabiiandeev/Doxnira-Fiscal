-- Operation 08B: additive purchases and sales core.
CREATE TABLE "purchase_orders" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "number" VARCHAR(80) NOT NULL,
 "supplier_id" UUID NOT NULL, "buyer_id" UUID NOT NULL, "warehouse_id" UUID NOT NULL,
 "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT', "issue_date" TIMESTAMP(3) NOT NULL,
 "expected_date" TIMESTAMP(3), "competence_date" TIMESTAMP(3), "payment_condition" VARCHAR(120),
 "freight_amount" DECIMAL(18,2) NOT NULL DEFAULT 0, "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0, "total_amount" DECIMAL(18,2) NOT NULL,
 "installments" JSONB NOT NULL DEFAULT '[]', "attachments" JSONB NOT NULL DEFAULT '[]', "notes" TEXT,
 "external_key" VARCHAR(180), "rejection_reason" VARCHAR(500), "cancellation_reason" VARCHAR(500),
 "submitted_at" TIMESTAMP(3), "approved_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "purchase_orders_status_check" CHECK ("status" IN ('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','RECEIVED','REJECTED','CANCELED'))
);
CREATE UNIQUE INDEX "purchase_orders_company_id_number_key" ON "purchase_orders"("company_id","number");
CREATE UNIQUE INDEX "purchase_orders_company_id_external_key_key" ON "purchase_orders"("company_id","external_key");
CREATE INDEX "purchase_orders_company_id_status_issue_date_idx" ON "purchase_orders"("company_id","status","issue_date" DESC);
CREATE INDEX "purchase_orders_company_id_supplier_id_idx" ON "purchase_orders"("company_id","supplier_id");

CREATE TABLE "purchase_order_items" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "purchase_order_id" UUID NOT NULL, "product_id" UUID NOT NULL,
 "quantity" DECIMAL(18,4) NOT NULL, "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
 "unit_cost" DECIMAL(18,6) NOT NULL, "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0, "total_amount" DECIMAL(18,2) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "purchase_order_items_quantity_check" CHECK ("quantity" > 0 AND "received_quantity" >= 0)
);
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_product_id_key" ON "purchase_order_items"("purchase_order_id","product_id");
CREATE INDEX "purchase_order_items_company_id_product_id_idx" ON "purchase_order_items"("company_id","product_id");

CREATE TABLE "purchase_receipts" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "purchase_order_id" UUID NOT NULL,
 "supplier_id" UUID NOT NULL, "warehouse_id" UUID NOT NULL, "nfe_entry_id" UUID,
 "idempotency_key" VARCHAR(180) NOT NULL, "justification" VARCHAR(500), "user_id" UUID NOT NULL,
 "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "purchase_receipts_company_id_idempotency_key_key" ON "purchase_receipts"("company_id","idempotency_key");
CREATE INDEX "purchase_receipts_company_id_purchase_order_id_received_at_idx" ON "purchase_receipts"("company_id","purchase_order_id","received_at" DESC);

CREATE TABLE "purchase_receipt_items" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "purchase_receipt_id" UUID NOT NULL,
 "purchase_order_item_id" UUID NOT NULL, "product_id" UUID NOT NULL,
 "ordered_quantity" DECIMAL(18,4) NOT NULL, "previous_quantity" DECIMAL(18,4) NOT NULL,
 "received_quantity" DECIMAL(18,4) NOT NULL, "divergence_quantity" DECIMAL(18,4) NOT NULL,
 "unit_cost" DECIMAL(18,6) NOT NULL, "inventory_movement_id" UUID,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "purchase_receipt_items_quantity_check" CHECK ("received_quantity" > 0)
);
CREATE UNIQUE INDEX "purchase_receipt_items_purchase_receipt_id_purchase_order_item_id_key" ON "purchase_receipt_items"("purchase_receipt_id","purchase_order_item_id");
CREATE INDEX "purchase_receipt_items_company_id_product_id_idx" ON "purchase_receipt_items"("company_id","product_id");

CREATE TABLE "sale_orders" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "number" VARCHAR(80) NOT NULL,
 "origin" VARCHAR(40) NOT NULL DEFAULT 'MANUAL', "external_key" VARCHAR(180), "marketplace_order_id" UUID,
 "client_id" UUID NOT NULL, "seller_id" UUID NOT NULL, "warehouse_id" UUID NOT NULL,
 "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT', "issue_date" TIMESTAMP(3) NOT NULL,
 "payment_condition" VARCHAR(120), "freight_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0, "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "total_amount" DECIMAL(18,2) NOT NULL, "notes" TEXT, "rejection_reason" VARCHAR(500),
 "cancellation_reason" VARCHAR(500), "submitted_at" TIMESTAMP(3), "approved_at" TIMESTAMP(3),
 "shipped_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "sale_orders_status_check" CHECK ("status" IN ('DRAFT','PENDING_APPROVAL','APPROVED','RESERVED','PARTIALLY_INVOICED','INVOICED','SHIPPED','COMPLETED','REJECTED','CANCELED','RETURNED'))
);
CREATE UNIQUE INDEX "sale_orders_company_id_number_key" ON "sale_orders"("company_id","number");
CREATE UNIQUE INDEX "sale_orders_company_id_external_key_key" ON "sale_orders"("company_id","external_key");
CREATE INDEX "sale_orders_company_id_status_issue_date_idx" ON "sale_orders"("company_id","status","issue_date" DESC);
CREATE INDEX "sale_orders_company_id_client_id_idx" ON "sale_orders"("company_id","client_id");

CREATE TABLE "sales_order_items" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "sales_order_id" UUID NOT NULL, "product_id" UUID NOT NULL,
 "quantity" DECIMAL(18,4) NOT NULL, "reserved_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
 "invoiced_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0, "returned_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
 "unit_price" DECIMAL(18,6) NOT NULL, "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0, "total_amount" DECIMAL(18,2) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "sales_order_items_quantity_check" CHECK ("quantity" > 0 AND "reserved_quantity" >= 0 AND "invoiced_quantity" >= 0 AND "returned_quantity" >= 0)
);
CREATE UNIQUE INDEX "sales_order_items_sales_order_id_product_id_key" ON "sales_order_items"("sales_order_id","product_id");
CREATE INDEX "sales_order_items_company_id_product_id_idx" ON "sales_order_items"("company_id","product_id");

CREATE TABLE "sales_invoice_allocations" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "sales_order_id" UUID NOT NULL,
 "fiscal_document_id" UUID, "document_type" VARCHAR(10) NOT NULL, "status" VARCHAR(30) NOT NULL DEFAULT 'PREPARED',
 "provider_required" BOOLEAN NOT NULL DEFAULT false, "quantities" JSONB NOT NULL,
 "total_amount" DECIMAL(18,2) NOT NULL, "idempotency_key" VARCHAR(180) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "sales_invoice_allocations_company_id_idempotency_key_key" ON "sales_invoice_allocations"("company_id","idempotency_key");
CREATE INDEX "sales_invoice_allocations_company_id_sales_order_id_idx" ON "sales_invoice_allocations"("company_id","sales_order_id");

CREATE TABLE "sales_returns" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "sales_order_id" UUID NOT NULL,
 "reason" VARCHAR(500) NOT NULL, "idempotency_key" VARCHAR(180) NOT NULL, "user_id" UUID NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "sales_returns_company_id_idempotency_key_key" ON "sales_returns"("company_id","idempotency_key");
CREATE INDEX "sales_returns_company_id_sales_order_id_idx" ON "sales_returns"("company_id","sales_order_id");

CREATE TABLE "sales_return_items" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "sales_return_id" UUID NOT NULL,
 "sales_order_item_id" UUID NOT NULL, "product_id" UUID NOT NULL, "quantity" DECIMAL(18,4) NOT NULL,
 "inventory_movement_id" UUID, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "sales_return_items_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "sales_return_items_sales_return_id_sales_order_item_id_key" ON "sales_return_items"("sales_return_id","sales_order_item_id");
CREATE INDEX "sales_return_items_company_id_product_id_idx" ON "sales_return_items"("company_id","product_id");

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE SET NULL;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_receipt_id_fkey" FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT;
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sale_orders"("id") ON DELETE CASCADE;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_invoice_allocations" ADD CONSTRAINT "sales_invoice_allocations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_invoice_allocations" ADD CONSTRAINT "sales_invoice_allocations_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sale_orders"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_invoice_allocations" ADD CONSTRAINT "sales_invoice_allocations_fiscal_document_id_fkey" FOREIGN KEY ("fiscal_document_id") REFERENCES "fiscal_documents"("id") ON DELETE SET NULL;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sale_orders"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE;
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
