DROP TABLE application_data CASCADE;
DROP TABLE contract_cache CASCADE;
DROP TABLE transactions CASCADE;
DROP TABLE topic CASCADE;

DROP FUNCTION translate("ByteId" bytea);
DROP FUNCTION account_info;
DROP TYPE account_info_t;
VACUUM FULL;