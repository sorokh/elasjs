var express = require('express');
var bodyParser = require('body-parser');
var pg = require('pg');
var bits = require('sqlbits');
var fs = require("fs");
var responseTime = require('response-time');

var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public/'));

// Time responses on the server-side.
/*
app.use(responseTime());

app.use(function(req,resp,next) {
    var start = Date.now();
    console.log("start " + start);
    next();
    var stop = Date.now();
    console.log("stop " + stop);
    console.log("Request took " + (stop - start) + " ms.");
});
*/

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
                client.query(countquery.sql, countquery.params, function(err, result) {
                    done();
                    if (err) {
                        console.log(err); resp.send("Error " + err);
                        return;
                    }
                    var count = parseInt(result.rows[0].count);

                    var query = SQL('select ' + columns + ' FROM "' + table + '"');

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

// Force https in production.
var forceSecure = function(req, res, next) {
    isHttps = req.headers['x-forwarded-proto'] == 'https'
    if ( ! isHttps && req.get('Host').indexOf( 'localhost' ) < 0 && req.get('Host').indexOf( '127.0.0.1' ) < 0 ) {
        console.log( 'forceSSL req.get = ' + req.get('Host') + ' req.url = ' + req.url )
        return res.redirect('https://' + req.get('Host') + req.url )
    }
    else if ( isHttps )
        console.log( 'No need to re-direct to HTTPS' )
    else
        console.log( 'Served from localhost, not redirecting to HTTPS' )

    next();
}

app.use( forceSecure );

// Configure REST API.
rest2pg(config);

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});