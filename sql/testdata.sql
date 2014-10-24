-- groups
INSERT INTO "communities" VALUES ('8bf649b4-c50a-4ee9-9b02-877aa0a71849','LETS Regio Dendermonde','https://www.facebook.com/pages/LETS-Regio-Dendermonde/113915938675095?ref=ts&fref=ts', 'Beekveldstraat', '1A', '2', '9280', 'Lebbeke', '0495940592', 'letsdendermonde@gmail.com');
INSERT INTO "communities" VALUES ('57561082-1506-41e8-a57e-98fee9289e0c','LETS Aalst-Oudenaarde', null, 'Wellekensstraat', '45', null, '9300', 'Aalst', null, 'PeterD@steunpuntwelzijn.be');

-- persons
INSERT INTO "persons" VALUES ('9abe4102-6a29-4978-991e-2a30655030e6','Sabine','De Waele','Beekveldstraat','1A','2','9280','Lebbeke','0495541522','sabinedewaele@email.be', -10, 'sabine', '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
INSERT INTO "persons" VALUES ('2f11714a-9c45-44d3-8cde-cd37eb0c048b','Nicole','De Gols','Kleinzand','25',NULL,'9200','Grembergen','052318252','nicole@email.be', 35, 'nicole', '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
INSERT INTO "persons" VALUES ('82565813-943e-4d1a-ac58-8b4cbc865bdb','Steven','Plas','Mierenstraat','1B',NULL,'9310','Meldert','052112233','mier@email.be', -25, 'steven', '57561082-1506-41e8-a57e-98fee9289e0c');

-- transactions
INSERT INTO "transactions" VALUES ('147d360c-2bdf-4b6e-a210-3cb8ddf3ce9d', '2014-10-11 04:05:06', '9abe4102-6a29-4978-991e-2a30655030e6','2f11714a-9c45-44d3-8cde-cd37eb0c048b', 'Heerlijke aardperen', 10);
INSERT INTO "transactions" VALUES ('8371eda9-56bc-41d5-af26-bc81caf3166a', '2014-10-13 04:05:06', '82565813-943e-4d1a-ac58-8b4cbc865bdb','2f11714a-9c45-44d3-8cde-cd37eb0c048b', 'Weckpotten', 25);

-- messages
INSERT INTO "messages" VALUES ('ad9ff799-7727-4193-a34a-09f3819c3479', '9abe4102-6a29-4978-991e-2a30655030e6', '2014-10-12 04:05:06', 'request', 'Oppas bij mij thuis op dinsdag 14/10 van 19u tot 22u30.', 'Ik mag naar een vergadering gaan in Dendermonde. Mijn zoontjes (8 en 6) gaan rond 20u15 slapen, daarna kan je dus doen waar je zin in hebt. TV, internet, een boek lezen...', 15, 'uur', '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
