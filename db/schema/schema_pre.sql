-- The program requires fresh tables for indexer to be initialized

\echo PSQL will remove tables if they exist, ignore these notices

DROP TABLE IF EXISTS application_data CASCADE;
DROP TABLE IF EXISTS contract_cache CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS topic CASCADE;
DROP TABLE profiles;
DROP TABLE subscriptions;

VACUUM FULL;

SET bytea_output = 'escape'; -- allows us to display binary values in hex, saving a lot of space using bytea

BEGIN;

-- Table for Application Settings
CREATE TABLE application_data (
  "id"             serial not null unique primary key,
  "field"          varchar,
  "value_bool"     boolean,
  "value_int"      bigint,
  "value_string"   varchar
);

-- Table for reduction of database size on grossly redundant entries
CREATE TABLE contract_cache (
  "id"         bigserial not null unique primary key,
  "byteId"     bytea not null,
  "account"    bytea unique not null,
  "weight"     integer not null -- externally determined weight in terms of frequency
);

-- Table to store all transaction hashes, block and timestamps
CREATE TABLE transactions (
  "id"         bigserial not null,
  "block"      integer not null,
  "timestamp"  integer not null,
  "hash"       bytea not null
) PARTITION BY RANGE ("block");

-- table to store accounts realted to a transaction hash
CREATE TABLE topic (
  "id"         bigserial not null, 
  "parent"     bigint not null,   -- this is not a hash but an integer id
  "account"    bytea not null      -- an account which was affected by this transaction
) PARTITION BY RANGE ("id");

-- subscription based service requires profiles to receive subscriptions
CREATE TABLE profiles (
  "id"            serial not null primary key,
  "status"        varchar not null default 'enabled',
  "identifier"    varchar unique
);

CREATE TABLE subscriptions (
  "id"             serial not null primary key,
  "profileId"      integer,
  "enabled"        boolean,
  "routeHandler"   varchar,
  "reference"      varchar,
  "routeMeta"      json, -- blob to be parsed by the routeHandler
  "deliveryMethod" varchar
);

COMMIT;


-- footnotes

-- about initing db on a separate drive
--https://stackoverflow.com/questions/25748285/initlocation-not-working-in-postgresql


