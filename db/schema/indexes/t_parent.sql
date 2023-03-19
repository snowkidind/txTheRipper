BEGIN;
CREATE INDEX topic_parent_idx ON topic("parent");
COMMIT;
