DO $$
DECLARE
  target_role TEXT;
  target_table TEXT;
  subscription_tables TEXT[] := ARRAY[
    'subscription_plans',
    'subscription_plan_prices',
    'subscription_features',
    'subscription_plan_features',
    'subscriptions',
    'subscription_usage_counters',
    'subscription_usage',
    'subscription_history',
    'billing_customers',
    'billing_provider_events'
  ];
BEGIN
  FOREACH target_table IN ARRAY subscription_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      target_table
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC',
      target_table
    );
  END LOOP;

  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      FOREACH target_table IN ARRAY subscription_tables LOOP
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',
          target_table,
          target_role
        );
      END LOOP;
    END IF;
  END LOOP;
END
$$;
