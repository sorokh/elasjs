DROP TABLE IF EXISTS "transactions";
DROP TABLE IF EXISTS "persons";
DROP TABLE IF EXISTS "groups";

CREATE TABLE "groups" (
  "guid" character varying(36) unique,
  "name" character varying(256) unique,
  "facebook" character varying(256) unique,
  "street" character varying(256),
  "streetnumber" character varying(16),
  "streetbus" character varying(16),
  "zipcode" character varying(16),
  "city" character varying(64),
  "phone" character varying(32),
  "email" character varying(32)
);

CREATE TABLE "persons" (
  "guid" character varying(36) unique,
  "firstname" character varying(128),
  "lastname" character varying(128),
  "street" character varying(256),
  "streetnumber" character varying(16),
  "streetbus" character varying(16),
  "zipcode" character varying(16),
  "city" character varying(64),
  "phone" character varying(32),
  "email" character varying(32),
  "balance" integer,
  "group" character varying(36) references "groups"(guid)
);

CREATE TABLE "transactions" (
  "guid" character varying(36) unique,
  "from" character varying(36) references "persons"(guid),
  "to" character varying(36) references "persons"(guid),
  "description" character varying(256),
  "amount" integer
);

CREATE TABLE "messages" (
  "guid" character varying(36) unique,
  "person" character varying(36) references "persons"(guid),
  "posted" timestamp,
  "type" character varying(10),
  "title" character varying(256),
  "description" character varying(1024),
  "amount" integer,
  "unit" character varying(32)
);
