INSERT INTO system_config (config_key, config_value, description, category)
VALUES (
  'enforce_cutoff_rules',
  'true'::jsonb,
  'Enforce cutoff rules when recording historical data and missing transactions.',
  'governance'
)
ON CONFLICT (config_key) DO NOTHING;
