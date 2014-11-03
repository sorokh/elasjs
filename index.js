var express = require('express');
var bodyParser = require('body-parser');
var pg = require('pg');
var bits = require('sqlbits');
var fs = require("fs");
var validator = require('jsonschema').Validator;
var Q = require("q");

var app = express();

//var logsql = true;
var logsql = false;

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

// logging on API calls.
app.use(function(req, res, next) {
    cl(req.method + " " + req.url + " starting.");
    var start = Date.now();
    res.on('finish', function() {
        var duration = Date.now() - start;
        cl(req.method + " took "  + duration + " ms. " + req.url);
    });
    next();
});


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
                    pgConnect().then(function(db) {
                        var q = bits.SQL('select count(*) FROM persons');
                        q.WHERE('email = ', bits.$(email), bits.AND, 'password = ', bits.$(password));
                        return pgExec(db,q).then(function(result) {
                            var count = parseInt(result.rows[0].count);
                            if(count == 1) {
                                // Found matching record, add to cache for subsequent requests.
                                knownPasswords[email] = password;
                                next();
                            } else {
                                cl("Wrong combination of email / password. Found " + count + " records.");
                                forbidden();
                            }
                        });
                    })
                    .fail(function() {forbidden();})
                    .fin(function() {resp.end()});
                }
            } else forbidden();
        } else forbidden();
    } else forbidden();
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

var validateCommunities = function(req, resp, elasBackend) {

};

var config = [
    {
        // Base url
        type: "/persons",
        // Requires authentication ?
        public: false,
        // Map json properties to postgres columns
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
        // JSON Schema
        schema: {},
        // Add extra URL parameters to SQL query.
        query: {
            communities: filterOnCommunities
        },
        // Afterupdate is executed when a successful update is executed.
        afterupdate : function(person) {
            // clear password cache if person is updated.
            knownPasswords = {};
        }
    },
    {
        type: "/messages",
        public: false,
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
        schema: {},
        query: {
            communities: filterOnCommunities
        }
    },
    {
        type: "/communities",
        public: true, // remove authorisation check.
        map: {
            name: {},
            street: {},
            streetnumber: {},
            zipcode: {},
            city: {},
            // Only allow create/update to set adminpassword, never show on output.
            adminpassword: { onlyinput: true },
            phone: {},
            email: {},
            facebook: {},
            website: {},
            currencyname: {}
        },
        schema: {
            $schema: "http://json-schema.org/schema#",
            name: {
                type: "string",
                minLength: 1,
                maxLength: 256
            },
            street: {
                type: "string",
                minLength: 1,
                maxLength: 256
            },
            streetnumber: {
                type: "string",
                minLength: 1,
                maxLength: 16
            },
            streetbus: {
                type: "string",
                minLength: 1,
                maxLength: 16
            },
            zipcode: {
                type: "integer",
                multipleOf: 1.0,
                minimum: 1000,
                maximum: 9999
            },
            city: {
                type: "string",
                minLength: 1,
                maxLength: 64
            },
            phone: {
                type: "string",
                pattern: "^[0-9]*$",
                minLength: 9,
                maxLength: 10
            },
            email: {
                type: "string",
                format: "email",
                minLength: 1,
                maxLength: 32
            },
            adminpassword: {
                type: "string",
                minLength: 5,
                maxLength: 64
            },
            website: {
                type: "string",
                minLength: 1,
                maxLength: 128,
                format: "uri"
            },
            facebook: {
                type: "string",
                minLength: 0,
                maxLength: 256,
                format: "uri"
            },
            currencyname: {
                type: "string",
                minLength: 1,
                maxLength: 32
            },
            required: ["name","street","streetnumber","zipcode","city", "phone","email", "adminpassword","currencyname"]
        },
        validate : validateCommunities
    },
    {
        type: "/transactions",
        public: false,
        map: {
            transactiontimestamp: {
                onInsert: function(input) { return new Date().toISOString(); },
                onUpdate: function(input) { return new Date().toISOString(); }
            },
            fromperson: {references: '/persons'},
            toperson: {references: '/persons'},
            description: {},
            amount: {}
        },
        schema: {}
    }
];

var pgConnect = function() {
    var deferred = Q.defer();

    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        if(err) {
            deferred.reject(err);
        } else {
            deferred.resolve({
                client: client,
                done: done
            });
        }
    });

    return deferred.promise;
};

var pgExec = function(db, bitsquery) {
    var deferred = Q.defer();

    var sql = bitsquery.sql;
    var params = bitsquery.params;

    if(logsql) {
        cl("sql : " + sql);
        cl("parameters : ");
        cl(params);
    }

    db.client.query(sql, params, function(err, result) {
        db.done();
        if (err) {
            if(logsql) {
                cl("sql error");
                cl(err);
            }
            deferred.reject(err);
        } else {
            if(logsql) {
                cl("sql result : ");
                cl(result.rows);
            }
            deferred.resolve(result);
        }
    });

    return deferred.promise;
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
                } else if(mapping.map[key].onlyinput) {
                    // Skip on output !
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

    queryByGuid : function(db, mapping, guid) {
        var columns = rest2pg_utils.sqlColumnNames(mapping);
        var table = mapping.type.split("/")[1];

        var query = bits.SQL('select ' + columns + ' FROM "' + table + '"');
        query.WHERE('"guid" = ', bits.$(guid));

        return pgExec(db,query).then(function(result) {
            var row=result.rows[0];
            var output = {};
            rest2pg_utils.mapColumnsToObject(mapping, row, output);
            return output;
        });
    },

    getSchemaValidationErrors : function(json, schema) {
        var asCode = function(s) {
            // return any string as code for REST API error object.
            var ret = s;

            ret = ret.toLowerCase().trim();
            ret = ret.replace(/[^a-z0-9 ]/gmi, "");
            ret = ret.replace(/ /gmi, ".");

            return ret;
        }
        var v = new validator();
        var result = v.validate(json, schema);

        if(result.errors && result.errors.length > 0) {
            var ret = {};
            ret.errors = [];
            ret.document = json;
            for(var i=0; i<result.errors.length; i++) {
                var current = result.errors[i];
                var err = {};
                err.code = asCode(current.message);
                ret.errors.push(err);
            }
            return ret;
        }
    }
}

function send500(resp) {
    return function(error) {
        cl("Error. Sending status 500.");
        cl(error);
        resp.status(500).send("Internal Server Error. [" + error.toString() + "]");
    };
}

function endResponse(resp) {
    return function() {
        resp.end();
    };
}

function rest2pg(config) {
    for(var configIndex = 0; configIndex < config.length; configIndex++) {
        var mapping = config[configIndex];
        var SQL = bits.SQL;
        var $ = bits.$;
        var url;

        // register schema for external usage. public.
        url = mapping.type + '/schema';
        app.get(url, function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];

            resp.set('Content-Type', 'application/json');
            resp.send(mapping.schema);
        });

        // register list resource for this type.
        url = mapping.type;
        if(!mapping.public) {
            app.use(url, checkBasicAuthentication);
        }
        app.get(url , function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];
            var columns = rest2pg_utils.sqlColumnNames(mapping);
            var table = mapping.type.split("/")[1];

            var countquery = SQL('select count(*) FROM "' + table + '"');
            rest2pg_utils.applyRequestParameters(mapping, req, countquery);
            pgConnect().then(function(db) {
                return pgExec(db,countquery).then(function (results) {
                    var count = parseInt(results.rows[0].count);
                    var query = SQL('select ' + columns + ' FROM "' + table + '"');
                    rest2pg_utils.applyRequestParameters(mapping, req, query);

                    // All list resources support orderby, limit and offset.
                    var orderby = req.query.orderby;
                    var descending = req.query.descending;
                    if (orderby) {
                        var valid = true;
                        var orders = orderby.split(",");
                        for (var o = 0; o < orders.length; o++) {
                            var order = orders[o];
                            if (!mapping.map[order]) {
                                valid = false;
                                break;
                            }
                        }
                        if (valid) {
                            query._("ORDER BY " + orders);
                            if (descending) query._("DESC");
                        } else {
                            cl("Can not order by [" + orderby + "]. One or more unknown properties. Ignoring orderby.");
                        }
                    }

                    if (req.query.limit) query.LIMIT(req.query.limit);
                    if (req.query.offset) query.OFFSET(req.query.offset);

                    return pgExec(db,query).then(function (result) {
                        var rows = result.rows;
                        var results = [];
                        for (var row = 0; row < rows.length; row++) {
                            var currentrow = rows[row];

                            var element = {
                                href: mapping.type + '/' + currentrow.guid
                            };

                            if (req.query.expand !== 'full') {
                                element.$$expanded = {
                                    $$meta: {
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
                            results: results
                        };
                        resp.set('Content-Type', 'application/json');
                        resp.send(output);
                    });
                });
            })
            .fail(send500(resp))
            .fin(endResponse(resp));
        }); // app.get - list resource

        // register single resource
        url = mapping.type + '/:guid';
        if(!mapping.public) {
            app.use(url, checkBasicAuthentication);
        }
        app.get(url, function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];
            var guid = req.params.guid;

            pgConnect().then(function(db) {
                return rest2pg_utils.queryByGuid(db, mapping, guid).then(function(element) {
                    element.$$meta = { permalink: mapping.type + '/' + guid };
                    resp.set('Content-Type', 'application/json');
                    resp.send(element);
                });
            })
            .fail(send500(resp))
            .fin(endResponse(resp));
        });

        // register PUT operation for inserts and updates
        url = mapping.type + '/:guid';
        if(!mapping.public) {
            app.use(url, checkBasicAuthentication);
        }
        app.put(url, function(req, resp) {
            var typeToConfig = rest2pg_utils.typeToConfig(config);
            var type = '/' + req.route.path.split("/")[1];
            var mapping = typeToConfig[type];
            var table = mapping.type.split("/")[1];

            var element = req.body;
            cl(element);

            if(mapping.schema) {
                var error = rest2pg_utils.getSchemaValidationErrors(element, mapping.schema);
                if(error) {
                    cl("Schema validation failed. Returning 409 Conflict with errors to client.");
                    resp.set('Content-Type', 'application/json');
                    resp.status(409).send(error);
                    return;
                }
            }

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
            pgConnect().then(function(db) {
                return pgExec(db,countquery).then(function(results) {
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

                        var update = bits.UPDATE(table).SET(element)._('where guid=', $(req.params.guid));
                        return pgExec(db,update).then(function(results) {
                            if(mapping.afterput) mapping.afterinsert(element);
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

                        var insert = bits.INSERT.INTO(table, element);
                        return pgExec(db,insert).then(function (results) {
                            if(mapping.afterput) mapping.afterinsert(element);
                        });
                    }
                });
            })
            .fail(send500(resp))
            .fin(endResponse(resp))
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

        pgConnect().then(function(db) {
            return pgExec(db,query).then(function(result) {
                var row=result.rows[0];
                var output = {};
                output.$$meta = {};
                output.$$meta.permalink = '/persons/' + row.guid;
                rest2pg_utils.mapColumnsToObject(mapping, row, output);
                resp.set('Content-Type', 'application/json');
                resp.send(output);
            });
        })
        .fail(send500(resp))
        .fin(endResponse(resp));
    }
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});
