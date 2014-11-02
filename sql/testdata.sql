-- groups
INSERT INTO "communities" VALUES ('8bf649b4-c50a-4ee9-9b02-877aa0a71849','LETS Regio Dendermonde', 'Beekveldstraat', '1A', '2', '9280', 'Lebbeke', '0495940592', 'letsdendermonde@gmail.com','admin','http://www.letsdendermonde.be','https://www.facebook.com/pages/LETS-Regio-Dendermonde/113915938675095?ref=ts&fref=ts','duim');
INSERT INTO "communities" VALUES ('57561082-1506-41e8-a57e-98fee9289e0c','LETS Aalst-Oudenaarde', 'Wellekensstraat', '45', null, '9300', 'Aalst', null, 'PeterD@steunpuntwelzijn.be', 'admin', 'http://www.welzijn.net/www_wp/sociaalweefsel/letsao/', null, 'iets');

-- persons
INSERT INTO "persons" VALUES ('9abe4102-6a29-4978-991e-2a30655030e6','Sabine','De Waele','Beekveldstraat','1A','2','9280','Lebbeke','0495541522','sabinedewaele@email.be', -10, 'sabine', '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
INSERT INTO "persons" VALUES ('2f11714a-9c45-44d3-8cde-cd37eb0c048b','Nicole','De Gols','Kleinzand','25',NULL,'9200','Grembergen','052318252','nicole@email.be', 35, 'nicole', '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
INSERT INTO "persons" VALUES ('82565813-943e-4d1a-ac58-8b4cbc865bdb','Steven','Plas','Mierenstraat','1B',NULL,'9310','Meldert','052112233','mier@email.be', -25, 'steven', '57561082-1506-41e8-a57e-98fee9289e0c');

-- transactions
INSERT INTO "transactions" VALUES ('147d360c-2bdf-4b6e-a210-3cb8ddf3ce9d', '2014-10-11 04:05:06', '9abe4102-6a29-4978-991e-2a30655030e6','2f11714a-9c45-44d3-8cde-cd37eb0c048b', 'Heerlijke aardperen', 10);
INSERT INTO "transactions" VALUES ('8371eda9-56bc-41d5-af26-bc81caf3166a', '2014-10-13 04:05:06', '82565813-943e-4d1a-ac58-8b4cbc865bdb','2f11714a-9c45-44d3-8cde-cd37eb0c048b', 'Weckpotten', 25);

-- messages
INSERT INTO "messages" VALUES ('ad9ff799-7727-4193-a34a-09f3819c3479', '9abe4102-6a29-4978-991e-2a30655030e6', '2014-10-12 04:05:06', 'request', 'Oppas bij mij thuis op dinsdag 14/10 van 19u tot 22u30.', 'Ik mag naar een vergadering gaan in Dendermonde. Mijn zoontjes (8 en 6) gaan rond 20u15 slapen, daarna kan je dus doen waar je zin in hebt. TV, internet, een boek lezen...', 15, 'uur', '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
INSERT INTO "messages" VALUES ('cf328c0a-7793-4b01-8544-bea8854147ab', '9abe4102-6a29-4978-991e-2a30655030e6', '2014-10-13 06:01:06', 'request', 'Wie kent Windows (versie 7) goed ?', 'Soms weet ik dat iets bestaat in windows, maar weet ik niet zo goed hoe ik het zelf kan instellen. Is er iemand met goede kennis van Windows ?', 20, 'uur', '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
INSERT INTO "messages" VALUES ('d70c98ca-9559-47db-ade6-e5da590b2435', '9abe4102-6a29-4978-991e-2a30655030e6', '2014-10-13 07:02:06', 'offer', 'Rabarberchutney', 'Zelfgemaakte chutney van rabarber met abrikoos, limoen, gember, pepertjes en nog andere kruiden.',   9, 'potje', '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
INSERT INTO "messages" VALUES ('a391efaf-485e-45bb-8688-87d7bdfee9f6', '2f11714a-9c45-44d3-8cde-cd37eb0c048b', '2014-10-14 07:02:06', 'request', 'Beamer lenen.', 'Heeft er iemand een beamer te leen? We willen graag eens een filmavondje doen !',   null, null, '8bf649b4-c50a-4ee9-9b02-877aa0a71849');
