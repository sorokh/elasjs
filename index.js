var express = require('express');
var bodyParser = require('body-parser');
var pg = require('pg');
var bits = require('sqlbits');
var fs = require("fs");

var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.json());

var cl = function(x) {
    console.log(x);
}

// Force https in production.
var forceSecure = function(req, res, next) {
    isHttps = req.headers['x-forwarded-proto'] == 'https'
    if ( ! isHttps && req.get('Host').indexOf( 'localhost' ) < 0 && req.get('Host').indexOf( '127.0.0.1' ) < 0 ) {
        return res.redirect('https://' + req.get('Host') + req.url )
    }

    next();
};
app.use(forceSecure);

app.use(express.static(__dirname + '/public/'));

var knownPasswords = {};

var checkBasicAuthentication = function(req, res, next) {
    var forbidden = function() {
        cl("Rejecting request !");
        res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
        res.status(401).send("Forbidden");
    };

    if(req.headers.authorization) {
        var basic = req.headers.authorization;
        var encoded = basic.substr(6);
        var decoded = new Buffer(encoded, 'base64').toString('utf-8');
        var firstColonIndex = decoded.indexOf(':');
        if(firstColonIndex != -1) {
            var email = decoded.substr(0,firstColonIndex);
            var password = decoded.substr(firstColonIndex + 1);

            if(email && password && email.length > 0 && password.length > 0) {
                if(knownPasswords[email]) {
                    if(knownPasswords[email] === password) {
                        next();
                    } else forbidden();
                } else {
                    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
                        var q = bits.SQL('select count(*) FROM persons');
                        q.WHERE('email = ', bits.$(email), bits.AND, 'password = ', bits.$(password));

                        cl(q.sql);
                        client.query(q.sql, q.params, function(err, result) {
                            done();
                            if (err) {
                                cl(err);
                                forbidden();
                            } else {
                                var count = parseInt(result.rows[0].count);
                                cl(count);
                                if(count == 1) {
                                    // Found matching record, add to cache for subsequent requests.
                                    knownPasswords[email] = password;
                                    next();
                                } else {
                                    cl("Wrong combination of email / password. Found " + count + " records.");
                                    forbidden();
                                }
                            }

                        });
                    });
                }
            } else forbidden();
        } else forbidden();
    } else {
        cl("No Authorization header detected.");
        forbidden();
    }
};

var filterOnCommunities = function(value, select) {
    var syntax = function() {
        console.log("ignoring parameter [communities] - syntax error. ["+ value + "]");
    }

    if(value) {
        var permalinks = value.split(",");
        var guids = [];
        for(var i=0; i<permalinks.length; i++) {
            if(permalinks[i].indexOf("/communities/") == 0) {
                var guid = permalinks[i].substr(13);
                if(guid.length == 36) {
                    guids.push(guid);
                } else {
                    syntax();
                    return;
                }
            } else {
                syntax();
                return;
            }
        }
        if(guid.length == 36) {
            select.WHERE('community').IN(guids);
        } else {
            syntax();
            return;
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
        },
        afterupdate : function(person) {
            // clear password cache if person is updated.
            knownPasswords = {};
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

var execSQL = function(bitsquery, success) {
    var sql = bitsquery.sql;
    var params = bitsquery.params;

    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        if(err) {
            cl("Error opening database connection..");
            return;
        }

        client.query(sql, params, function(err, result) {
            done();
            if (err) {
                console.log(err);
                resp.send("Error " + err);
                return;
            }

            success(result);
        });
    });
};

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

        var standard_parameters = ['orderby','descending','limit','offset'];

        if(mapping.query) {
            for (var key in urlparameters) {
                if (urlparameters.hasOwnProperty(key)) {
                    if(standard_parameters.indexOf(key) == -1) {
                        if(mapping.query[key]) {
                            mapping.query[key](urlparameters[key], select);
                        } else {
                            console.log("Unknown query parameter [" + key + "]. Ignoring..");
                        }
                    }
                }
            }
        }
    },

    queryByGuid : function(mapping, guid, success) {
        var columns = rest2pg_utils.sqlColumnNames(mapping);
        var table = mapping.type.split("/")[1];

        var query = bits.SQL('select ' + columns + ' FROM "' + table + '"');
        query.WHERE('"guid" = ', bits.$(guid));

        execSQL(query, function(result) {
            var row=result.rows[0];
            var output = {};

            rest2pg_utils.mapColumnsToObject(mapping, row, output);
            if(success) success(output);
        });
    }
}

function rest2pg(config) {
    for(var configIndex = 0; configIndex < config.length; configIndex++) {
        var mapping = config[configIndex];
        var SQL = bits.SQL;
        var $ = bits.$;
        var url;

        // register list resource for this type.
        url = mapping.type;
        app.use(url, checkBasicAuthentication);
        app.get(url , function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];
            var columns = rest2pg_utils.sqlColumnNames(mapping);
            var table = mapping.type.split("/")[1];

            var start = Date.now();
            console.log("GET " + mapping.type);

            var countquery = SQL('select count(*) FROM "' + table + '"');
            rest2pg_utils.applyRequestParameters(mapping, req, countquery);
            execSQL(countquery, function(results) {
                var count = parseInt(results.rows[0].count);
                var query = SQL('select ' + columns + ' FROM "' + table + '"');
                rest2pg_utils.applyRequestParameters(mapping, req, query);

                // All list resources support orderby, limit and offset.
                var orderby = req.query.orderby;
                var descending = req.query.descending;
                if(orderby) {
                    var valid = true;
                    var orders = orderby.split(",");
                    for(var o=0; o<orders.length; o++) {
                        var order = orders[o];
                        if(!mapping.map[order]) {
                            valid=false;
                            break;
                        }
                    }
                    if(valid) {
                        query.ORDERBY(orders);
                        if(descending) query._("DESC");
                    } else {
                        cl("Can not order by [" + orderby + "]. One or more unknown properties. Ignoring orderby.");
                    }
                }

                if(req.query.limit) query.LIMIT(req.query.limit);
                if(req.query.offset) query.OFFSET(req.query.offset);

//                console.log(query.sql);
                execSQL(query, function(result) {
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
                    resp.send(output);
                });
            });
        }); // app.get - list resource

        // register single resource
        url = mapping.type + '/:guid';
        app.use(url, checkBasicAuthentication);
        app.get(url, function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];
            var guid = req.params.guid;
            cl("GET " + mapping.type + "/" + req.params.guid);

            rest2pg_utils.queryByGuid(mapping, guid, function(element) {
                    // success
                    element.$$meta = { permalink: mapping.type + '/' + guid };
                    resp.send(element);
                });
        });

        // register PUT operation for inserts and updates
        url = mapping.type + '/:guid';
        app.use(url, checkBasicAuthentication);
        app.put(url, function(req, resp) {
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

            var countquery = bits.SQL('select count(*) from ' + table).WHERE('"guid" = ', bits.$(req.params.guid));
            execSQL(countquery, function(results) {
                if(results.rows[0].count == 1) {
                    for (var key in mapping.map) {
                        if (mapping.map.hasOwnProperty(key)) {
                            if(mapping.map[key].onUpdate) {
                                var value = element[key];
                                var translated = mapping.map[key].onUpdate(value);
                                element[key] = translated;
                            }
                        }
                    }

                    var update =
                        bits.UPDATE(table)
                            .SET(element)
                            ._('where guid=', $(req.params.guid));

                    execSQL(update, function(results) {
                        if(mapping.afterput) mapping.afterinsert(element);
                        resp.send("");
                    });
                } else {
                    element.guid = req.params.guid;
                    for (var key in mapping.map) {
                        if (mapping.map.hasOwnProperty(key)) {
                            if (mapping.map[key].onInsert) {
                                var value = element[key];
                                var translated = mapping.map[key].onInsert(value);
                                element[key] = translated;
                            }
                        }
                    }

                    var insert =
                        bits.INSERT.INTO(table, element);
                    execSQL(insert, function (results) {
                        if(mapping.afterput) mapping.afterinsert(element);
                        resp.send("");
                    });
                }
            });
        });
    }
}
// Configure REST API.
rest2pg(config);

app.use('/me', checkBasicAuthentication);
app.get('/me', function(req,resp) {
    var typeToMapping = rest2pg_utils.typeToConfig(config);
    var mapping = typeToMapping['/persons'];
    var columns = rest2pg_utils.sqlColumnNames(mapping);
    var table = mapping.type.split("/")[1];

    var basic = req.headers.authorization;
    var encoded = basic.substr(6);
    var decoded = new Buffer(encoded, 'base64').toString('utf-8');
    var firstColonIndex = decoded.indexOf(':');
    if(firstColonIndex != -1) {
        var email = decoded.substr(0,firstColonIndex);
        var query = bits.SQL('select ' + columns + ',guid FROM ' + table);
        query.WHERE('email = ', bits.$(email));

        execSQL(query, function(result) {
            var row=result.rows[0];
            var output = {};
            output.$$meta = {};
            output.$$meta.permalink = '/persons/' + row.guid;
            rest2pg_utils.mapColumnsToObject(mapping, row, output);
            resp.send(output);
        });
    }
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});
