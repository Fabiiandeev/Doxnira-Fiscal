CREATE TABLE "marketplace_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'pending_credentials',
    "external_account_id" VARCHAR(120),
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketplace_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketplace_connections_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "marketplace_connections_company_id_provider_external_account_id_key"
  ON "marketplace_connections"("company_id", "provider", "external_account_id");
CREATE INDEX "marketplace_connections_company_id_status_idx"
  ON "marketplace_connections"("company_id", "status");

CREATE TABLE "marketplace_sync_cursors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "resource_type" VARCHAR(40) NOT NULL,
    "cursor" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketplace_sync_cursors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketplace_sync_cursors_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_sync_cursors_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "marketplace_sync_cursors_connection_id_resource_type_key"
  ON "marketplace_sync_cursors"("connection_id", "resource_type");
CREATE INDEX "marketplace_sync_cursors_company_id_resource_type_idx"
  ON "marketplace_sync_cursors"("company_id", "resource_type");

CREATE TABLE "marketplace_sync_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL DEFAULT 'FULL',
    "status" VARCHAR(30) NOT NULL DEFAULT 'queued',
    "idempotency_key" VARCHAR(160) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketplace_sync_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketplace_sync_jobs_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_sync_jobs_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "marketplace_sync_jobs_idempotency_key_key"
  ON "marketplace_sync_jobs"("idempotency_key");
CREATE INDEX "marketplace_sync_jobs_company_id_status_idx"
  ON "marketplace_sync_jobs"("company_id", "status");
CREATE INDEX "marketplace_sync_jobs_connection_id_created_at_idx"
  ON "marketplace_sync_jobs"("connection_id", "created_at" DESC);
CREATE UNIQUE INDEX "marketplace_sync_jobs_one_active_full_idx"
  ON "marketplace_sync_jobs"("connection_id")
  WHERE "type" = 'FULL' AND "status" IN ('queued', 'running');

CREATE TABLE "marketplace_sync_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "sync_job_id" UUID,
    "type" VARCHAR(60) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_sync_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketplace_sync_events_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_sync_events_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_sync_events_sync_job_id_fkey"
      FOREIGN KEY ("sync_job_id") REFERENCES "marketplace_sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "marketplace_sync_events_company_id_created_at_idx"
  ON "marketplace_sync_events"("company_id", "created_at" DESC);
CREATE INDEX "marketplace_sync_events_connection_id_created_at_idx"
  ON "marketplace_sync_events"("connection_id", "created_at" DESC);
CREATE INDEX "marketplace_sync_events_sync_job_id_idx"
  ON "marketplace_sync_events"("sync_job_id");

CREATE TABLE "marketplace_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "provider_event_id" VARCHAR(160) NOT NULL,
    "topic" VARCHAR(120),
    "payload" JSONB NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'received',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_webhook_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketplace_webhook_events_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_webhook_events_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "marketplace_webhook_events_connection_id_provider_event_id_key"
  ON "marketplace_webhook_events"("connection_id", "provider_event_id");
CREATE INDEX "marketplace_webhook_events_company_id_created_at_idx"
  ON "marketplace_webhook_events"("company_id", "created_at" DESC);
CREATE INDEX "marketplace_webhook_events_status_created_at_idx"
  ON "marketplace_webhook_events"("status", "created_at");

CREATE TABLE "marketplace_listing_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "provider_listing_id" VARCHAR(160) NOT NULL,
    "sku" VARCHAR(120),
    "title" VARCHAR(255),
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "price" DECIMAL(15,2),
    "currency" CHAR(3),
    "raw_payload" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketplace_listing_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketplace_listing_links_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_listing_links_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "marketplace_listing_links_connection_id_provider_listing_id_key"
  ON "marketplace_listing_links"("connection_id", "provider_listing_id");
CREATE INDEX "marketplace_listing_links_company_id_status_idx"
  ON "marketplace_listing_links"("company_id", "status");
CREATE INDEX "marketplace_listing_links_company_id_sku_idx"
  ON "marketplace_listing_links"("company_id", "sku");

CREATE TABLE "marketplace_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "provider_order_id" VARCHAR(160) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ordered_at" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketplace_orders_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_orders_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "marketplace_orders_connection_id_provider_order_id_key"
  ON "marketplace_orders"("connection_id", "provider_order_id");
CREATE INDEX "marketplace_orders_company_id_status_ordered_at_idx"
  ON "marketplace_orders"("company_id", "status", "ordered_at" DESC);
CREATE INDEX "marketplace_orders_connection_id_ordered_at_idx"
  ON "marketplace_orders"("connection_id", "ordered_at" DESC);

CREATE TABLE "marketplace_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider_item_id" VARCHAR(160) NOT NULL,
    "sku" VARCHAR(120),
    "title" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketplace_order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketplace_order_items_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "marketplace_order_items_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_order_items_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "marketplace_order_items_order_id_provider_item_id_key"
  ON "marketplace_order_items"("order_id", "provider_item_id");
CREATE INDEX "marketplace_order_items_company_id_idx"
  ON "marketplace_order_items"("company_id");
