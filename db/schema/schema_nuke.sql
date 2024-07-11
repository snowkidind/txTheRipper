DROP FUNCTION translate("ByteId" bytea) CASCADE;
DROP FUNCTION account_info CASCADE;
DROP TYPE account_info_t CASCADE;

DROP TABLE application_data CASCADE;
DROP TABLE contract_cache CASCADE;
DROP TABLE transactions CASCADE;
DROP TABLE topic CASCADE;
DROP TABLE profiles CASCADE;
DROP TABLE subscriptions CASCADE;


VACUUM FULL;