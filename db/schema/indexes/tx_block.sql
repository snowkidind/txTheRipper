BEGIN;
CREATE INDEX transactions_block_idx ON transactions("block");
COMMIT;
