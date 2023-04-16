CREATE OR REPLACE FUNCTION translate("ByteId" bytea)
RETURNS VARCHAR
LANGUAGE plpgsql AS $$
DECLARE
  _account bytea;
  _length integer;
BEGIN
  SELECT LENGTH("ByteId") INTO _length;
  IF _length = 42 THEN 
    RETURN encode("ByteId", 'escape');
  END IF;
  SELECT account INTO _account 
  FROM contract_cache 
  WHERE "byteId" = "ByteId";
  RETURN encode(_account, 'escape');
END;
$$;

CREATE TYPE account_info_t AS (
    id         bigint,
    block      integer,
    timestamp  integer,
    hash       text,
    account    text
);

CREATE OR REPLACE FUNCTION account_info(
  "Account"   varchar, 
  "FromBlock" integer,
  "Limit"     integer,
  "Offset"    integer)
RETURNS SETOF account_info_t
LANGUAGE plpgsql AS $$
DECLARE
  _result account_info_t%rowtype;
  _block integer;
BEGIN
  IF "FromBlock" IS NULL THEN _block = 0;
  ELSE _block = "FromBlock"; END IF;
  RETURN QUERY SELECT tr.id, tr.block, tr.timestamp, encode(tr.hash, 'escape') AS hash, encode(t.account, 'escape') AS account 
  FROM transactions tr 
  INNER JOIN topic t ON tr.id = t.parent AND t.account = LOWER("Account")::BYTEA AND tr.block >= _block
  ORDER BY tr.block DESC LIMIT "Limit" OFFSET "Offset";
END;
$$;
