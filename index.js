var express = require('express');
var pg = require('pg');
var bits = require('sqlbits');
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/'));

app.get('/persons/:guid', function(req, resp) {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        var SQL = bits.SQL;
        var $ = bits.$;

        var query = SQL('select "guid","firstname","lastname","street","streetnumber","streetbus","zipcode","city","phone","email","balance","group" FROM persons')
            .WHERE('"guid" = ', $(req.params.guid));

        client.query(query.sql, query.params, function(err, result) {
            done();
            if (err) {
                console.log(err); resp.send("Error " + err);
                return;
            }

            var row=result.rows[0];
            var output = {
                $$meta : {
                    permalink: '/persons/' + row.guid
                },
                firstname : row.firstname,
                lastname : row.lastname,
                street : row.street,
                streetnumber : row.streetnumber,
                streetbus : row.streetbus,
                zipcode : row.zipcode,
                city : row.city,
                phone : row.phone,
                email : row.email,
                balance : row.balance,
                group : '/groups/' + row.group
            };
            resp.send(output);
        });
  });
});

app.get('/persons', function(req, resp) {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        var SQL = bits.SQL;
        var $ = bits.$;
        var params = req.query;

        var query = SQL('select "guid","firstname","lastname","street","streetnumber","streetbus","zipcode","city","phone","email","balance","group" FROM persons')
            .WHERE('"group" = ', $(params.group));

        client.query(query.sql, query.params, function(err, result) {
            done();
            if (err) {
                console.log(err); resp.send("Error " + err);
                return;
            }

            var rows=result.rows;
            var results = [];
            for(var i=0; i<rows.length; i++) {
                var row = rows[i];
                results.push({
                    href: '/persons/' + row.guid,
                    $$expanded : {
                        $$meta : {
                            permalink: '/persons/' + row.guid
                        },
                        firstname : row.firstname,
                        lastname : row.lastname,
                        street : row.street,
                        streetnumber : row.streetnumber,
                        streetbus : row.streetbus,
                        zipcode : row.zipcode,
                        city : row.city,
                        phone : row.phone,
                        email : row.email,
                        balance : row.balance,
                        group : '/groups/' + row.group
                    }
                });
            }
            var output = {
                $$meta: {
                    count: rows.length
                },
                results : results
            };

            resp.send(output);
        });
    });
});

app.get('/groups/:guid', function(req, resp) {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        var SQL = bits.SQL;
        var $ = bits.$;

        var query = SQL('select "guid","name","street","streetnumber","streetbus","zipcode","city","facebook","phone","email" FROM "groups"')
            .WHERE('"guid" = ', $(req.params.guid));

        client.query(query.sql, query.params, function(err, result) {
            done();
            if (err) {
                console.log(err); resp.send("Error " + err);
                return;
            }

            var row=result.rows[0];
            var output = {
                $$meta : {
                    permalink: '/groups/' + row.guid
                },
                name : row.name,
                street : row.street,
                streetnumber : row.streetnumber,
                streetbus : row.streetbus,
                zipcode : row.zipcode,
                city : row.city,
                facebook : row.facebook,
                phone : row.phone,
                email : row.email
            };
            resp.send(output);
        });
    });
});

app.get('/groups', function(req, resp) {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        var SQL = bits.SQL;
        var $ = bits.$;
        var params = req.query;

        var query = SQL('select "guid","name","street","streetnumber","streetbus","zipcode","city","facebook","phone","email" FROM "groups"');
        client.query(query.sql, query.params, function(err, result) {
            done();
            if (err) {
                console.log(err); resp.send("Error " + err);
                return;
            }

            var rows=result.rows;
            var results = [];
            for(var i=0; i<rows.length; i++) {
                var row = rows[i];
                results.push({
                    href: '/groups/' + row.guid,
                    $$expanded : {
                        $$meta : {
                            permalink: '/groups/' + row.guid
                        },
                        name : row.name,
                        street : row.street,
                        streetnumber : row.streetnumber,
                        streetbus : row.streetbus,
                        zipcode : row.zipcode,
                        facebook : row.facebook,
                        city : row.city,
                        phone : row.phone,
                        email : row.email
                    }
                });
            }
            var output = {
                $$meta: {
                    count: rows.length
                },
                results : results
            };
            resp.send(output);
        });
    });
});

app.get('/transactions', function(req, resp) {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        var SQL = bits.SQL;
        var $ = bits.$;
        var params = req.query;

        var query = SQL('select "guid","from","to","description","amount" FROM "transactions"');
        client.query(query.sql, query.params, function(err, result) {
            done();
            if (err) {
                console.log(err); resp.send("Error " + err);
                return;
            }

            var rows=result.rows;
            var results = [];
            for(var i=0; i<rows.length; i++) {
                var row = rows[i];
                results.push({
                    href: '/transactions/' + row.guid,
                    $$expanded : {
                        $$meta : {
                            permalink: '/transactions/' + row.guid
                        },
                        from : '/persons/' + row.from,
                        to : '/persons/' + row.to,
                        description : row.description,
                        amount : row.amount
                    }
                });
            }
            var output = {
                $$meta: {
                    count: rows.length
                },
                results : results
            };
            resp.send(output);
        });
    });
});

app.get('/transactions/:guid', function(req, resp) {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        var SQL = bits.SQL;
        var $ = bits.$;

        var query = SQL('select "guid","from","to","description","amount" FROM "transactions"')
            .WHERE('"guid" = ', $(req.params.guid));

        client.query(query.sql, query.params, function(err, result) {
            done();
            if (err) {
                console.log(err); resp.send("Error " + err);
                return;
            }

            var row=result.rows[0];
            var output = {
                $$meta : {
                    permalink: '/transactions/' + row.guid
                },
                from : '/persons/' + row.from,
                to : '/persons/' + row.to,
                description : row.description,
                amount : row.amount
            };
            resp.send(output);
        });
    });
});

app.get('/messages', function(req, resp) {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        var SQL = bits.SQL;
        var $ = bits.$;
        var params = req.query;

        var query = SQL('select "guid","person","posted","type","title","description","amount","unit" FROM "messages"');
        client.query(query.sql, query.params, function(err, result) {
            done();
            if (err) {
                console.log(err); resp.send("Error " + err);
                return;
            }

            var rows=result.rows;
            var results = [];
            for(var i=0; i<rows.length; i++) {
                var row = rows[i];
                results.push({
                    href: '/messages/' + row.guid,
                    $$expanded : {
                        $$meta : {
                            permalink: '/messages/' + row.guid
                        },
                        person : '/persons/' + row.person,
                        posted : row.posted,
                        type : row.type,
                        title : row.title,
                        description: row.description,
                        amount : row.amount,
                        unit: row.unit
                    }
                });
            }
            var output = {
                $$meta: {
                    count: rows.length
                },
                results : results
            };
            resp.send(output);
        });
    });
});

app.get('/messages/:guid', function(req, resp) {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        var SQL = bits.SQL;
        var $ = bits.$;

        var query = SQL('select "guid","person","posted","type","title","description","amount","unit" FROM "messages"')
            .WHERE('"guid" = ', $(req.params.guid));

        client.query(query.sql, query.params, function(err, result) {
            done();
            if (err) {
                console.log(err); resp.send("Error " + err);
                return;
            }

            var row=result.rows[0];
            var output = {
                $$meta : {
                    permalink: '/messages/' + row.guid
                },
                person : '/persons/' + row.person,
                posted : row.posted,
                type : row.type,
                title : row.title,
                description: row.description,
                amount : row.amount,
                unit: row.unit
            };
            resp.send(output);
        });
    });
});


app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});
