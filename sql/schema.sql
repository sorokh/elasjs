DROP TABLE IF EXISTS "messages";
DROP TABLE IF EXISTS "transactions";
DROP TABLE IF EXISTS "persons";
DROP TABLE IF EXISTS "communities";
DROP TABLE IF EXISTS "groups";

CREATE TABLE "communities" (
  "guid" character varying(36) unique,
  "name" character varying(256) unique,
  "facebook" character varying(256) unique,
  "street" character varying(256) not null,
  "streetnumber" character varying(16) not null,
  "streetbus" character varying(16),
  "zipcode" character varying(16) not null,
  "city" character varying(64) not null,
  "phone" character varying(32),
  "email" character varying(32) not null,
  "adminpassword" character varying(64) not null,
  "website" character varying(128),
  "currencyname" character varying(32) not null
);

CREATE TABLE "persons" (
  "guid" character varying(36) unique,
  "firstname" character varying(128) not null,
  "lastname" character varying(128) not null,
  "street" character varying(256),
  "streetnumber" character varying(16),
  "streetbus" character varying(16),
  "zipcode" character varying(16),
  "city" character varying(64),
  "phone" character varying(32),
  "email" character varying(32) unique,
  "balance" integer not null,
  "password" character varying(64),
  "community" character varying(36) references "communities"(guid)
);

CREATE TABLE "transactions" (
  "guid" character varying(36) unique,
  "transactiontimestamp" timestamp not null,
  "fromperson" character varying(36) references "persons"(guid),
  "toperson" character varying(36) references "persons"(guid),
  "description" character varying(256),
  "amount" integer not null
);

CREATE TABLE "messages" (
  "guid" character varying(36) unique,
  "person" character varying(36) references "persons"(guid),
  "posted" timestamp not null,
  "type" character varying(10) not null,
  "title" character varying(256) not null,
  "description" character varying(1024),
  "amount" integer,
  "unit" character varying(32),
  "community" character varying(36) references "communities"(guid)
);
