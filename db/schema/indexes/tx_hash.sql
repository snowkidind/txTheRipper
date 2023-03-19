BEGIN;
CREATE INDEX transactions_hash_idx ON transactions("hash");
COMMIT;