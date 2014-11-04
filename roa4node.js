var pg = require('pg');
var bits = require('sqlbits');
var validator = require('jsonschema').Validator;
var Q = require("q");

var SQL = bits.SQL;
var $ = bits.$;
var AND = bits.AND;
var INSERT = bits.INSERT;
var UPDATE = bits.UPDATE;

var configuration;
var resources;
var logsql;

var pgConnect = function () {
    var deferred = Q.defer();

    pg.connect(process.env.DATABASE_URL + "?ssl=true", function (err, client, done) {
        if (err) {
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

var pgExec = function (db, bitsquery) {
    var deferred = Q.defer();

    var sql = bitsquery.sql;
    var params = bitsquery.params;

    if (logsql) {
        cl("sql : " + sql);
        cl("parameters : ");
        cl(params);
    }

    db.client.query(sql, params, function (err, result) {
        db.done();
        if (err) {
            if (logsql) {
                cl("sql error");
                cl(err);
            }
            deferred.reject(err);
        } else {
            if (logsql) {
                cl("sql result : ");
                cl(result.rows);
            }
            deferred.resolve(result);
        }
    });

    return deferred.promise;
};

var typeToConfig = function(config) {
    var ret = {};
    for (var i = 0; i < config.length; i++) {
        ret[config[i].type] = config[i];
    }
    return ret;
};

function mapColumnsToObject(config, mapping, row, element) {
    var typeToMapping = typeToConfig(config);

    // add all mapped columns to output.
    for (var key in mapping.map) {
        if (mapping.map.hasOwnProperty(key)) {
            if (mapping.map[key].references) {
                var referencedType = mapping.map[key].references;
                element[key] = {href: typeToMapping[referencedType].type + '/' + row[key]};
            } else if (mapping.map[key].onlyinput) {
                // Skip on output !
            } else {
                element[key] = row[key];
            }
        }
    }
}

function sqlColumnNames(mapping) {
    var columnNames = [];

    for (var key in mapping.map) {
        if (mapping.map.hasOwnProperty(key)) {
            columnNames.push(key);
        }
    }
    var sqlColumnNames = 'guid,';
    for (var j = 0; j < columnNames.length; j++) {
        sqlColumnNames += columnNames[j];
        if (j < columnNames.length - 1) {
            sqlColumnNames += ",";
        }
    }

    return sqlColumnNames;
}

// apply extra parameters on request URL to select.
function applyRequestParameters(mapping, req, select) {
    var urlparameters = req.query;

    var standard_parameters = ['orderby', 'descending', 'limit', 'offset'];

    if (mapping.query) {
        for (var key in urlparameters) {
            if (urlparameters.hasOwnProperty(key)) {
                if (standard_parameters.indexOf(key) == -1) {
                    if (mapping.query[key]) {
                        mapping.query[key](urlparameters[key], select);
                    } else {
                        console.log("Unknown query parameter [" + key + "]. Ignoring..");
                    }
                }
            }
        }
    }
}

function queryByGuid(config, db, mapping, guid) {
    var columns = sqlColumnNames(mapping);
    var table = mapping.type.split("/")[1];

    var query = SQL('select ' + columns + ' FROM "' + table + '"');
    query.WHERE('"guid" = ', $(guid));

    return pgExec(db, query).then(function (result) {
        var row = result.rows[0];
        var output = {};
        mapColumnsToObject(config, mapping, row, output);
        return output;
    });
}

function getSchemaValidationErrors(json, schema) {
    var asCode = function (s) {
        // return any string as code for REST API error object.
        var ret = s;

        ret = ret.toLowerCase().trim();
        ret = ret.replace(/[^a-z0-9 ]/gmi, "");
        ret = ret.replace(/ /gmi, ".");

        return ret;
    }
    var v = new validator();
    var result = v.validate(json, schema);

    if (result.errors && result.errors.length > 0) {
        var ret = {};
        ret.errors = [];
        ret.document = json;
        for (var i = 0; i < result.errors.length; i++) {
            var current = result.errors[i];
            var err = {};
            err.code = asCode(current.message);
            ret.errors.push(err);
        }
        return ret;
    }
}

function send500(resp) {
    return function (error) {
        cl("Error. Sending status 500.");
        cl(error);
        resp.status(500).send("Internal Server Error. [" + error.toString() + "]");
    };
}

function endResponse(resp) {
    return function () {
        resp.end();
    };
}

function cl(x) {
    console.log(x);
}

var knownPasswords = {};

// Force https in production.
function forceSecureSockets(req, res, next) {
    isHttps = req.headers['x-forwarded-proto'] == 'https'
    if (!isHttps && req.get('Host').indexOf('localhost') < 0 && req.get('Host').indexOf('127.0.0.1') < 0) {
        return res.redirect('https://' + req.get('Host') + req.url)
    }

    next();
}

function checkBasicAuthentication(req, res, next) {
    var forbidden = function () {
        cl("Rejecting request !");
        res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
        res.status(401).send("Forbidden");
    };

    if (req.headers.authorization) {
        var basic = req.headers.authorization;
        var encoded = basic.substr(6);
        var decoded = new Buffer(encoded, 'base64').toString('utf-8');
        var firstColonIndex = decoded.indexOf(':');
        if (firstColonIndex != -1) {
            var email = decoded.substr(0, firstColonIndex);
            var password = decoded.substr(firstColonIndex + 1);

            if (email && password && email.length > 0 && password.length > 0) {
                if (knownPasswords[email]) {
                    if (knownPasswords[email] === password) {
                        next();
                    } else forbidden();
                } else {
                    pgConnect().then(function (db) {
                        var q = SQL('select count(*) FROM persons');
                        q.WHERE('email = ', $(email), AND, 'password = ', $(password));
                        return pgExec(db, q).then(function (result) {
                            var count = parseInt(result.rows[0].count);
                            if (count == 1) {
                                // Found matching record, add to cache for subsequent requests.
                                knownPasswords[email] = password;
                                next();
                            } else {
                                cl("Wrong combination of email / password. Found " + count + " records.");
                                forbidden();
                            }
                        });
                    })
                        .fail(function () {
                            forbidden();
                        })
                        .fin(function () {
                            resp.end()
                        });
                }
            } else forbidden();
        } else forbidden();
    } else forbidden();
}

function logRequests(req, res, next) {
    cl(req.method + " " + req.url + " starting.");
    var start = Date.now();
    res.on('finish', function () {
        var duration = Date.now() - start;
        cl(req.method + " took " + duration + " ms. " + req.url);
    });
    next();
}

/* express.js application, configuration for roa4node */
exports = module.exports = {
    configure: function (app, config) {
        configuration = config;
        resources = config.resources;
        logsql = config.logsql;

        app.use(forceSecureSockets);
        app.use(logRequests);

        for (var configIndex = 0; configIndex < resources.length; configIndex++) {
            var mapping = resources[configIndex];
            var url;

            // register schema for external usage. public.
            url = mapping.type + '/schema';
            app.get(url, function (req, resp) {
                var typeToMapping = typeToConfig(resources);
                var type = '/' + req.route.path.split("/")[1];
                var mapping = typeToMapping[type];

                resp.set('Content-Type', 'application/json');
                cl(mapping.schema);
                resp.send(mapping.schema);
            });

            // register list resource for this type.
            url = mapping.type;
            if (!mapping.public) {
                app.use(url, checkBasicAuthentication);
            }
            app.get(url, function (req, resp) {
                var typeToMapping = typeToConfig(resources);
                var type = '/' + req.route.path.split("/")[1];
                var mapping = typeToMapping[type];
                var columns = sqlColumnNames(mapping);
                var table = mapping.type.split("/")[1];

                var countquery = SQL('select count(*) FROM "' + table + '"');
                applyRequestParameters(mapping, req, countquery);
                pgConnect().then(function (db) {
                    return pgExec(db, countquery).then(function (results) {
                        var count = parseInt(results.rows[0].count);
                        var query = SQL('select ' + columns + ' FROM "' + table + '"');
                        applyRequestParameters(mapping, req, query);

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

                        return pgExec(db, query).then(function (result) {
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
                                    mapColumnsToObject(resources, mapping, currentrow, element.$$expanded);
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
            if (!mapping.public) {
                app.use(url, checkBasicAuthentication);
            }
            app.get(url, function (req, resp) {
                var typeToMapping = typeToConfig(resources);
                var type = '/' + req.route.path.split("/")[1];
                var mapping = typeToMapping[type];
                var guid = req.params.guid;

                pgConnect().then(function (db) {
                    return queryByGuid(resources, db, mapping, guid).then(function (element) {
                        element.$$meta = {permalink: mapping.type + '/' + guid};
                        resp.set('Content-Type', 'application/json');
                        resp.send(element);
                    });
                })
                    .fail(send500(resp))
                    .fin(endResponse(resp));
            });

            // register PUT operation for inserts and updates
            url = mapping.type + '/:guid';
            if (!mapping.public) {
                app.use(url, checkBasicAuthentication);
            }
            app.put(url, function (req, resp) {
                var typeToMapping = typeToConfig(resources);
                var type = '/' + req.route.path.split("/")[1];
                var mapping = typeToMapping[type];
                var table = mapping.type.split("/")[1];

                var element = req.body;
                cl(element);

                if (mapping.schema) {
                    var error = getSchemaValidationErrors(element, mapping.schema);
                    if (error) {
                        cl("Schema validation failed. Returning 409 Conflict with errors to client.");
                        resp.set('Content-Type', 'application/json');
                        resp.status(409).send(error);
                        return;
                    }
                }

                // check and remove types from references.
                for (var key in mapping.map) {
                    if (mapping.map.hasOwnProperty(key)) {
                        if (mapping.map[key].references) {
                            var value = element[key].href;
                            var referencedType = mapping.map[key].references;
                            var referencedMapping = typeToMapping[referencedType];
                            var parts = value.split("/");
                            var type = '/' + parts[1];
                            var guid = parts[2];
                            if (type === referencedMapping.type) {
                                element[key] = guid;
                            } else {
                                console.log("Faulty reference detected [" + element[key].href + "], detected [" + type + "] expected [" + referencedMapping.type + "]");
                                return;
                            }
                        }
                    }
                }

                var countquery = SQL('select count(*) from ' + table).WHERE('"guid" = ', $(req.params.guid));
                pgConnect().then(function (db) {
                    return pgExec(db, countquery).then(function (results) {
                        if (results.rows[0].count == 1) {
                            for (var key in mapping.map) {
                                if (mapping.map.hasOwnProperty(key)) {
                                    if (mapping.map[key].onUpdate) {
                                        var value = element[key];
                                        var translated = mapping.map[key].onUpdate(value);
                                        element[key] = translated;
                                    }
                                }
                            }

                            var update = UPDATE(table).SET(element)._('where guid=', $(req.params.guid));
                            return pgExec(db, update).then(function (results) {
                                if (mapping.afterput) mapping.afterinsert(element);
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

                            var insert = INSERT.INTO(table, element);
                            return pgExec(db, insert).then(function (results) {
                                if (mapping.afterput) mapping.afterinsert(element);
                            });
                        }
                    });
                })
                    .fail(send500(resp))
                    .fin(endResponse(resp))
            });
        }

        app.use('/me', checkBasicAuthentication);
        app.get('/me', function (req, resp) {
            var typeToMapping = typeToConfig(resources);
            var mapping = typeToMapping['/persons'];
            var columns = sqlColumnNames(mapping);
            var table = mapping.type.split("/")[1];

            var basic = req.headers.authorization;
            var encoded = basic.substr(6);
            var decoded = new Buffer(encoded, 'base64').toString('utf-8');
            var firstColonIndex = decoded.indexOf(':');
            if (firstColonIndex != -1) {
                var email = decoded.substr(0, firstColonIndex);
                var query = SQL('select ' + columns + ',guid FROM ' + table);
                query.WHERE('email = ', $(email));

                pgConnect().then(function (db) {
                    return pgExec(db, query).then(function (result) {
                        var row = result.rows[0];
                        var output = {};
                        output.$$meta = {};
                        output.$$meta.permalink = '/persons/' + row.guid;
                        mapColumnsToObject(resources, mapping, row, output);
                        resp.set('Content-Type', 'application/json');
                        resp.send(output);
                    });
                })
                    .fail(send500(resp))
                    .fin(endResponse(resp));
            }
        });
    },

    // Call this is you want to clear the passwords cache for the API.
    clearPasswordCache : function() {
        knownPasswords = {};
    }
}
