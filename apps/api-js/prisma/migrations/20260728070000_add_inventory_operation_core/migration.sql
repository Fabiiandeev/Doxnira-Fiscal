-- Operation 08A: additive inventory core.
CREATE TABLE "operation_warehouses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "operation_warehouses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operation_warehouses_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX "operation_warehouses_company_id_code_key"
    ON "operation_warehouses"("company_id", "code");
CREATE UNIQUE INDEX "operation_warehouses_one_active_default"
    ON "operation_warehouses"("company_id")
    WHERE "is_default" = true AND "status" = 'ACTIVE';
CREATE INDEX "operation_warehouses_company_id_status_idx"
    ON "operation_warehouses"("company_id", "status");

CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "physical_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reserved_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "minimum_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_balances_quantities_check" CHECK (
        "physical_quantity" >= 0 AND "reserved_quantity" >= 0
        AND "reserved_quantity" <= "physical_quantity"
        AND "minimum_quantity" >= 0 AND "average_cost" >= 0
    )
);

CREATE UNIQUE INDEX "inventory_balances_warehouse_id_product_id_key"
    ON "inventory_balances"("warehouse_id", "product_id");
CREATE INDEX "inventory_balances_company_id_product_id_idx"
    ON "inventory_balances"("company_id", "product_id");
CREATE INDEX "inventory_balances_company_id_warehouse_id_idx"
    ON "inventory_balances"("company_id", "warehouse_id");

CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "previous_quantity" DECIMAL(18,4) NOT NULL,
    "resulting_quantity" DECIMAL(18,4) NOT NULL,
    "source_type" VARCHAR(40),
    "source_id" VARCHAR(100),
    "external_key" VARCHAR(180),
    "idempotency_key" VARCHAR(180) NOT NULL,
    "reason" VARCHAR(500),
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_quantity_check" CHECK ("quantity" <> 0),
    CONSTRAINT "inventory_movements_type_check" CHECK ("type" IN (
      'INITIAL_BALANCE','PURCHASE_RECEIPT','SALE_RESERVATION','SALE_RELEASE',
      'SALE_SHIPMENT','FISCAL_ENTRY','FISCAL_EXIT','MANUAL_ADJUSTMENT',
      'TRANSFER_OUT','TRANSFER_IN','INVENTORY_ADJUSTMENT','RETURN_IN',
      'RETURN_OUT','MARKETPLACE_RESERVATION'
    ))
);

CREATE UNIQUE INDEX "inventory_movements_company_id_idempotency_key_key"
    ON "inventory_movements"("company_id", "idempotency_key");
CREATE INDEX "inventory_movements_company_id_created_at_idx"
    ON "inventory_movements"("company_id", "created_at" DESC);
CREATE INDEX "inventory_movements_company_id_product_id_created_at_idx"
    ON "inventory_movements"("company_id", "product_id", "created_at" DESC);
CREATE INDEX "inventory_movements_company_id_warehouse_id_created_at_idx"
    ON "inventory_movements"("company_id", "warehouse_id", "created_at" DESC);

CREATE TABLE "inventory_reservations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "source_type" VARCHAR(40) NOT NULL,
    "source_id" VARCHAR(100),
    "external_key" VARCHAR(180) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_reservations_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "inventory_reservations_status_check" CHECK ("status" IN ('ACTIVE','CONFIRMED','RELEASED','EXPIRED','CANCELED'))
);

CREATE UNIQUE INDEX "inventory_reservations_company_id_external_key_key"
    ON "inventory_reservations"("company_id", "external_key");
CREATE INDEX "inventory_reservations_company_id_product_id_status_idx"
    ON "inventory_reservations"("company_id", "product_id", "status");
CREATE INDEX "inventory_reservations_company_id_warehouse_id_status_idx"
    ON "inventory_reservations"("company_id", "warehouse_id", "status");

CREATE TABLE "inventory_transfers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_warehouse_id" UUID NOT NULL,
    "destination_warehouse_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "reason" VARCHAR(500),
    "requested_by_id" UUID NOT NULL,
    "completed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_transfers_warehouses_check" CHECK ("source_warehouse_id" <> "destination_warehouse_id"),
    CONSTRAINT "inventory_transfers_status_check" CHECK ("status" IN ('DRAFT','PENDING','COMPLETED','CANCELED'))
);

CREATE INDEX "inventory_transfers_company_id_status_created_at_idx"
    ON "inventory_transfers"("company_id", "status", "created_at" DESC);
CREATE INDEX "inventory_transfers_company_id_source_warehouse_id_idx"
    ON "inventory_transfers"("company_id", "source_warehouse_id");
CREATE INDEX "inventory_transfers_company_id_destination_warehouse_id_idx"
    ON "inventory_transfers"("company_id", "destination_warehouse_id");

CREATE TABLE "inventory_transfer_items" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_transfer_items_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "inventory_transfer_items_transfer_id_product_id_key"
    ON "inventory_transfer_items"("transfer_id", "product_id");
CREATE INDEX "inventory_transfer_items_company_id_product_id_idx"
    ON "inventory_transfer_items"("company_id", "product_id");

CREATE TABLE "inventory_counts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "responsible_id" UUID NOT NULL,
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_counts_status_check" CHECK ("status" IN ('DRAFT','COUNTING','COMPLETED','CANCELED'))
);

CREATE INDEX "inventory_counts_company_id_status_created_at_idx"
    ON "inventory_counts"("company_id", "status", "created_at" DESC);
CREATE INDEX "inventory_counts_company_id_warehouse_id_idx"
    ON "inventory_counts"("company_id", "warehouse_id");

CREATE TABLE "inventory_count_items" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "count_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "expected_quantity" DECIMAL(18,4) NOT NULL,
    "counted_quantity" DECIMAL(18,4),
    "difference_quantity" DECIMAL(18,4),
    "adjustment_movement_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_count_items_counted_check" CHECK ("counted_quantity" IS NULL OR "counted_quantity" >= 0)
);

CREATE UNIQUE INDEX "inventory_count_items_count_id_product_id_key"
    ON "inventory_count_items"("count_id", "product_id");
CREATE INDEX "inventory_count_items_company_id_product_id_idx"
    ON "inventory_count_items"("company_id", "product_id");

ALTER TABLE "stock_movements"
    ADD COLUMN "warehouse_id" UUID,
    ADD COLUMN "origin" VARCHAR(40),
    ADD COLUMN "related_document_id" TEXT,
    ADD COLUMN "user_id" UUID,
    ADD COLUMN "justification" TEXT,
    ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "stock_movements_company_id_idempotency_key_key"
    ON "stock_movements"("company_id", "idempotency_key");

ALTER TABLE "operation_warehouses" ADD CONSTRAINT "operation_warehouses_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_source_warehouse_id_fkey"
    FOREIGN KEY ("source_warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_destination_warehouse_id_fkey"
    FOREIGN KEY ("destination_warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_requested_by_id_fkey"
    FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_completed_by_id_fkey"
    FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_transfer_id_fkey"
    FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "operation_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_responsible_id_fkey"
    FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_count_id_fkey"
    FOREIGN KEY ("count_id") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_adjustment_movement_id_fkey"
    FOREIGN KEY ("adjustment_movement_id") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
