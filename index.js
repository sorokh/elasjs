var express = require('express');
var bodyParser = require('body-parser');
var pg = require('pg');
var bits = require('sqlbits');
var fs = require("fs");

var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.json());

app.use(express.static(__dirname + '/public/'));

// Force https in production.
var forceSecure = function(req, res, next) {
    isHttps = req.headers['x-forwarded-proto'] == 'https'
    if ( ! isHttps && req.get('Host').indexOf( 'localhost' ) < 0 && req.get('Host').indexOf( '127.0.0.1' ) < 0 ) {
        return res.redirect('https://' + req.get('Host') + req.url )
    }

    next();
}

app.use( forceSecure );

var filterOnCommunities = function(value, select) {
    if(value) {
        var guid = value.substr(13);
        if(guid.length == 36) {
            select.WHERE('"community" = ', bits.$(guid));
        } else {
            console.log("ignoring parameter [communities] - syntax error. ["+ value + "]");
        }
    }
};

var config = [
    {
        type: "/persons",
        map: {
            firstname: {},
            lastname: {},
            street: {},
            streetnumber: {},
            streetbus: {},
            zipcode: {},
            city: {},
            phone: {},
            email: {},
            balance: {},
            community: {references: '/communities'}
        },
        query: {
            communities: filterOnCommunities
        }
    },
    {
        type: "/messages",
        map: {
            person: {references: '/persons'},
            posted: {
                onInsert: function(input) { return new Date().toISOString(); },
                onUpdate: function(input) { return new Date().toISOString(); }
            },
            type: {},
            title: {},
            description: {},
            amount: {},
            unit: {},
            community: {references: '/communities'}
        },
        query: {
            communities: filterOnCommunities
        }
    },
    {
        type: "/communities",
        map: {
            name: {},
            street: {},
            streetnumber: {},
            zipcode: {},
            city: {},
            facebook: {},
            phone: {},
            email: {}
        }
    },
    {
        type: "/transactions",
        map: {
            transactiontimestamp: {},
            fromperson: {references: '/persons'},
            toperson: {references: '/persons'},
            description: {},
            amount: {}
        }
    }
];

var rest2pg_utils = {
    typeToConfig : function(config) {
        var ret = {};
        for(var i=0; i<config.length; i++) {
            ret[config[i].type] = config[i];
        }
        return ret;
    },

    mapColumnsToObject : function(mapping, row, element) {
        var typeToConfig = this.typeToConfig(config);

        // add all mapped columns to output.
        for (var key in mapping.map) {
            if (mapping.map.hasOwnProperty(key)) {
                if(mapping.map[key].references) {
                    var referencedType = mapping.map[key].references;
                    element[key] = { href: typeToConfig[referencedType].type + '/' + row[key] };
                } else {
                    element[key] = row[key];
                }
            }
        }
    },

    sqlColumnNames : function(mapping) {
        var columnNames = [];

        for (var key in mapping.map) {
            if (mapping.map.hasOwnProperty(key)) {
                columnNames.push(key);
            }
        }
        var sqlColumnNames = 'guid,';
        for(var j=0; j<columnNames.length; j++) {
            sqlColumnNames += columnNames[j];
            if(j < columnNames.length - 1) {
                sqlColumnNames += ",";
            }
        }

        return sqlColumnNames;
    },

    // apply extra parameters on request URL to select.
    applyRequestParameters: function(mapping, req, select) {
        var urlparameters = req.query;

        if(mapping.query) {
            for (var key in urlparameters) {
                if (urlparameters.hasOwnProperty(key)) {
                    if(mapping.query[key]) {
                        mapping.query[key](urlparameters[key], select);
                    } else {
                        console.log("Unknown query parameter [" + key + "]. Ignoring..");
                    }
                }
            }
        }
    }
}


function rest2pg(config) {
    for(var configIndex = 0; configIndex < config.length; configIndex++) {
        var mapping = config[configIndex];
        var SQL = bits.SQL;
        var $ = bits.$;

        // register list resource for this type.
        app.get(mapping.type, function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];
            var columns = rest2pg_utils.sqlColumnNames(mapping);
            var table = mapping.type.split("/")[1];

            var start = Date.now();
            console.log("GET " + mapping.type);

            pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
                var countquery = SQL('select count(*) FROM "' + table + '"');

                // Apply request parameters.
                rest2pg_utils.applyRequestParameters(mapping, req, countquery);

                client.query(countquery.sql, countquery.params, function(err, result) {
                    done();
                    if (err) {
                        console.log(err); resp.send("Error " + err);
                        return;
                    }
                    var count = parseInt(result.rows[0].count);

                    var query = SQL('select ' + columns + ' FROM "' + table + '"');

                    // Apply request parameters.
                    rest2pg_utils.applyRequestParameters(mapping, req, query);

                    // All list resources support orderby, limit and offset.
                    if(req.query.orderby) query.ORDERBY(req.query.orderby);
                    if(req.query.limit) query.LIMIT(req.query.limit);
                    if(req.query.offset) query.OFFSET(req.query.offset);

                    client.query(query.sql, query.params, function(err, result) {
                        // TODO : make implementation streaming, extract count query...
                        done();
                        if (err) {
                            console.log(err); resp.send("Error " + err);
                            var stop = Date.now();
                            console.log("Request took " + (stop - start) + " ms.");
                            return;
                        }

                        var rows=result.rows;
                        var results = [];
                        for(var row=0; row<rows.length; row++) {
                            var currentrow = rows[row];

                            var element = {
                                href: mapping.type + '/' + currentrow.guid
                            };

                            if(req.query.expand !== 'full') {
                                element.$$expanded = {
                                    $$meta : {
                                        permalink: mapping.type + '/' + currentrow.guid
                                    }
                                }

                                rest2pg_utils.mapColumnsToObject(mapping, currentrow, element.$$expanded);
                            }

                            results.push(element);
                        }

                        var output = {
                            $$meta: {
                                count: count
                            },
                            results : results
                        };
                        // TODO : Implement next link.
                        //if(req.query.offset + req.query.limit < count) output.$$meta.next = r
                        resp.send(output);

                        var stop = Date.now();
                        console.log("Request took " + (stop - start) + " ms.");
                    }); // client.query -- select data
                }); // client.query - select count(*)
            }); // pg.connect
        }); // app.get - list resource

        // register single resource
        app.get(mapping.type + '/:guid', function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];
            var table = mapping.type.split("/")[1];
            var columns = rest2pg_utils.sqlColumnNames(mapping);

            var start = Date.now();
            console.log("GET " + mapping.type + "/" + req.params.guid);

            pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
                var query = SQL('select ' + columns + ' FROM "' + table + '"');
                query.WHERE('"guid" = ', $(req.params.guid));

                client.query(query.sql, query.params, function(err, result) {
                    done();
                    if (err) {
                        console.log(err); resp.send("Error " + err);
                        var stop = Date.now();
                        console.log("Request took " + (stop - start) + " ms.");
                        return;
                    }

                    var row=result.rows[0];
                    var output = {
                        $$meta : {
                            permalink: mapping.type + '/' + row.guid
                        }
                    };

                    rest2pg_utils.mapColumnsToObject(mapping, row, output);

                    resp.send(output);

                    var stop = Date.now();
                    console.log("Request took " + (stop - start) + " ms.");
                });
            });
        });

        // register PUT operation for inserts and updates
        app.put(mapping.type + '/:guid', function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];
            var table = mapping.type.split("/")[1];

            var element = req.body;

            var start = Date.now();
            console.log("PUT " + mapping.type + "/" + req.params.guid);
            console.log(element);

            // check and remove types from references.
            for (var key in mapping.map) {
                if (mapping.map.hasOwnProperty(key)) {
                    if(mapping.map[key].references) {
                        var value = element[key].href;
                        var referencedType = mapping.map[key].references;
                        var referencedMapping = typeToConfig[referencedType];
                        var parts = value.split("/");
                        var type = '/' + parts[1];
                        var guid = parts[2];
                        if(type === referencedMapping.type) {
                            element[key] = guid;
                        } else {
                            console.log("Faulty reference detected [" + element[key].href +"], detected [" + type + "] expected [" + referencedMapping.type + "]" );
                            return;
                        }
                    }
                }
            }

            pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
                var query = bits.SQL('select count(*) from ' + table).WHERE('"guid" = ', bits.$(req.params.guid));

                client.query(query.sql, query.params, function(err, result) {
                    done();
                    if (err) {
                        console.log(err); resp.send("Error " + err);
                        return;
                    }

                    if(result.rows[0].count == 1) {
                        for (var key in mapping.map) {
                            if (mapping.map.hasOwnProperty(key)) {
                                if(mapping.map[key].onUpdate) {
                                    var value = element[key];
                                    var translated = mapping.map[key].onUpdate(value);
                                    element[key] = translated;
                                }
                            }
                        }

                        console.log(element);

                        var update =
                            bits.UPDATE(table)
                                .SET(element)
                                ._('where guid=', $(req.params.guid));

                        client.query(update.sql,update.params, function(err, result) {
                            done();
                            if (err) {
                                console.log(err); resp.send("Error " + err);
                                var stop = Date.now();
                                console.log("Request took " + (stop - start) + " ms.");
                                return;
                            }
                            var stop = Date.now();
                            console.log("Request took " + (stop - start) + " ms.");
                        });
                    } else {
                        element.guid = req.params.guid;
                        for (var key in mapping.map) {
                            if (mapping.map.hasOwnProperty(key)) {
                                if(mapping.map[key].onInsert) {
                                    var value = element[key];
                                    var translated = mapping.map[key].onInsert(value);
                                    element[key] = translated;
                                }
                            }
                        }

                        var insert =
                            bits.INSERT.INTO(table,element);

                        client.query(insert.sql,insert.params, function(err, result) {
                            done();
                            if (err) {
                                console.log(err); resp.send("Error " + err);
                                var stop = Date.now();
                                console.log("Request took " + (stop - start) + " ms.");
                                return;
                            }
                            var stop = Date.now();
                            console.log("Request took " + (stop - start) + " ms.");
                        });
                    }
                });
            });
        });
    }
}
// Configure REST API.
rest2pg(config);

app.get('/generatetestdata', function(req,resp) {
/*    var max_communities = 2;
    var max_persons = 2;
    var max_messages = 2;*/
    var max_communities = 40;
    var max_persons = 70;
    var max_messages = 2;

    var generateUUID = function() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x7|0x8)).toString(16);
        });
        return uuid;
    };

    var communities = [];
    for(var community=0; community<max_communities; community++) {
        var communityuuid = generateUUID();
        var currentcommunity = {
            "guid": communityuuid,
            "name": "Community " + Math.random(),
            "facebook": "https://www.facebook.com/pages/LETS-Regio-Dendermonde/113915938675095?ref=ts&fref=ts" + Math.random(),
            "street": "Fabrieksstraat",
            "streetNumber": "31",
            "streetBus" : "1a",
            "zipcode": "9280",
            "city": "Lebbeke",
            "phone": "0492792059",
            "email": "dimitry_dhondt@yahoo.com"
        };
        communities.push(currentcommunity);
    }

    var persons = [];
    for(var community=0; community<communities.length; community++) {
        var currentcommunity = communities[community];
        var communityuuid = currentcommunity.guid;

        for(var person=0; person<max_persons; person++) {
            var personuuid = generateUUID();
            var currentperson = {
                "guid": personuuid,
                "firstname": "John " + Math.random(),
                "lastName": "Doe",
                "street": "Fabrieksstraat",
                "streetNumber": "31",
                "streetBus": "1a",
                "zipcode": "9280",
                "city": "Lebbeke",
                "phone": "0492792059",
                "email": "dimitry_dhondt@yahoo.com",
                "balance": 0,
                "community": communityuuid
            };
            persons.push(currentperson);
        }
    }

    var messages = [];
    for(var person=0; person<persons.length; person++) {
        var currentperson = persons[person];
        var personuuid = currentperson.guid;

        for(var message=0; message<max_messages; message++) {
            var messageguid = generateUUID();
            var currentmessage = {
                "guid": messageguid,
                "person": personuuid,
                "posted": "2014-10-29T02:05:06.000Z",
                "type": "request",
                "title": "Title van de vraag.",
                "description": "Ik vraag ..." + Math.random(),
                "amount": 20,
                "unit": "uur",
                "community": communityuuid
            };
            messages.push(currentmessage);
        }
    }

    console.log("communities " + communities.length);
    console.log("persons " + persons.length);
    console.log("messages " + messages.length);

    var object2sql = function(table, object) {
        var insert = 'INSERT INTO ' + table + ' VALUES (';
        var first = true;
        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                if(!first) insert += ",";
                insert += "'" + object[key] + "'";
                first = false;
            }
        }
        insert += ');\n';

        return insert;
    };

    var stream = fs.createWriteStream("/tmp/insert.sql");
    stream.once('open', function(fd) {
        for(var i=0; i<communities.length; i++) {
            var insert = object2sql("communities", communities[i]);
            stream.write(insert);
        }
        for(var i=0; i<persons.length; i++) {
            var insert = object2sql("persons", persons[i]);
            stream.write(insert);
        }
        for(var i=0; i<messages.length; i++) {
            var insert = object2sql("messages", messages[i]);
            stream.write(insert);
        }
        stream.end();
    });
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});