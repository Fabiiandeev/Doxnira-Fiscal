BEGIN;

ALTER TABLE "fleet_vehicles"
  DROP CONSTRAINT IF EXISTS "fleet_vehicles_plate_check",
  ADD CONSTRAINT "fleet_vehicles_plate_check"
    CHECK ("plate" ~ '^[A-Z]{3}[0-9A-Z][0-9][0-9A-Z][0-9]$');

COMMIT;
