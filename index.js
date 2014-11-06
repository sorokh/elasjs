// External includes
var express = require('express');
var bodyParser = require('body-parser');
var Q = require("q");

// Local includes
var roa = require("./roa4node.js");
var $u = roa.utils;
var $m = roa.mapUtils;
var $s = roa.schemaUtils;

var app = express();
app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public/'));

var cl = function(x) {
    console.log(x);
};

var filterOnCommunities = function(value, select) {
    var syntax = function() {
        cl("ignoring parameter [communities] - syntax error. ["+ value + "]");
    };

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

roa.configure(app,
    {
        logsql : true,
        resources : [
            {
                // Base url, maps 1:1 with a table in postgres (same name, except the '/' is removed)
                type: "/persons",
                // Is this resource public ? (I.e.: Can it be read / updated / inserted publicly ?
                public: false,
                /*
                 JSON properties are mapped 1:1 to columns in the postgres table.
                 Every property can also register 3 possible functions:

                 - onupdate : is executed before UPDATE on the table
                 - oninsert : is executed before INSERT into the table
                 - onread : is executed after SELECT from then table

                 All 3 receive 2 parameters :
                 - the key they were registered on.
                 - the javascript element being PUT.

                 All functions are executed in order of listing here.

                 All are allowed to manipulate the element, before it is inserted/updated in the table.
                 */
                map: {
                    firstname: {},
                    lastname: {},
                    street: {},
                    streetnumber: {},
                    streetbus: { onread: $m.removeifnull },
                    zipcode: {},
                    city: {},
                    phone: { onread: $m.removeifnull },
                    email: { onread: $m.removeifnull },
                    balance: {
                        oninsert: $m.value(0),
                        onupdate: $m.remove
                    },
                    community: {references: '/communities'}
                },
                // When a PUT operation is executed there are 2 phases of validate.
                // Validation phase 1 is schema validation.
                schemaUtils: {
                    $schema: "http://json-schema.org/schema#",
                    firstname: $s.string(1,128),
                    lastname: $s.string(1,128),
                    street: $s.string(1,256),
                    streetnumber: $s.string(1,16),
                    streetbus: $s.string(1,16),
                    zipcode: $s.zipcode,
                    city: $s.string(1,64),
                    phone: $s.phone,
                    email: $s.email,
                    // balance should not be validated. It can never be PUT ! If PUT, it is ignored. See above.
                    required: ["firstname","lastname","street","streetnumber","zipcode","city"]
                },
                // Validation phase 2 : an array of functions with validation rules.
                // All functions are executed. If any of them return an error object the PUT operation returns 409.
                // The output is a combination of all error objects returned by the validation rules/
                validate: [],
                // All queries are URLs. Any allowed URL parameter is configured here. A function can be registered.
                // This function receives 2 parameters :
                //  - the value of the request parameter (string)
                //  - a SQLbits SELECT object.
                // TODO : Should be inside an bits.AND() construction with default condition (1=1 AND ...)
                query: {
                    communities: filterOnCommunities
                },
                /*
                Hooks for psot-processing can be registered to perform desired things, like clear a cache,
                do further processing, etc..

                 - afterupdate
                 - afterinsert

                These post-processing functions receive 2 arguments:

                 - a 'db' object, that can be used to call roa4node.executeSQL, with a valid SQLbits statement.
                   This object contains 3 things :
                    - client : a pg-connect client object
                    - done : a pg-connect done function
                    - bits : a reference to SQLbits

                 - the element that was just updated / created.

                 These functions must return a Q promise. When this promise resolves, all executed SQL will
                 be commited on the database. When this promise fails, all executed SQL (including the original insert
                 or update triggered by the API call) will be rolled back.
                */
                afterupdate: [
                    function (db, element) { $u.clearPasswordCache(); }
                ],
                afterinsert: []
            },
            {
                type: "/messages",
                public: false,
                map: {
                    person: {references: '/persons'},
                    posted: {
                        oninsert: $m.now,
                        onupdate: $m.now
                    },
                    type: {},
                    title: {},
                    description: { onread: $m.removeifnull },
                    amount: { onread: $m.removeifnull },
                    unit: { onread: $m.removeifnull },
                    community: {references: "/communities"}
                },
                schemaUtils: {
                    $schema: "http://json-schema.org/schema#",
                    type: "object",
                    properties : {
                        person: $s.permalink("/persons"),
                        type: {
                            type: "string",
                            description: "Is this message offering something, or is it requesting something ?",
                            enum: ["offer","request"]
                        },
                        title: $s.string(1,256),
                        description: $s.string(0,1024),
                        amount: $s.numeric,
                        unit: $s.string(0,32),
                        community: $s.permalink("/communities")
                    },
                    required: ["person","type","title","community"]
                },
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
                    streetbus: { onread: $m.removeifnull },
                    zipcode: {},
                    city: {},
                    // Only allow create/update to set adminpassword, never show on output.
                    adminpassword: { onread: $m.remove },
                    phone: { onread: $m.removeifnull },
                    email: {},
                    facebook: { onread: $m.removeifnull },
                    website: { onread: $m.removeifnull },
                    currencyname: {}
                },
                schemaUtils: {
                    $schema: "http://json-schema.org/schema#",
                    name: $s.string(1,256),
                    street: $s.string(1,256),
                    streetnumber: $s.string(1,16),
                    streetbus: $s.string(1,16),
                    zipcode: $s.zipcode,
                    city: $s.string(1,64),
                    phone: $s.phone,
                    email: $s.email,
                    adminpassword: $s.string(5,64),
                    website: $s.url,
                    facebook: $s.url,
                    currencyname: $s.string(1,32),
                    required: ["name", "street", "streetnumber", "zipcode", "city", "phone", "email", "adminpassword", "currencyname"]
                },
                validate: [ validateCommunities ]
            },
            {
                type: "/transactions",
                public: false,
                map: {
                    transactiontimestamp: {
                        oninsert: $m.now,
                        onupdate: $m.now
                    },
                    fromperson: {references: '/persons'},
                    toperson: {references: '/persons'},
                    description: {},
                    amount: {}
                },
                schemaUtils: {
                    $schema: "http://json-schema.org/schema#",
                    transactiontimestamp: $s.timestamp,
                    fromperson: $s.permalink("/persons"),
                    toperson: $s.permalink("/persons"),
                    description: $s.string(1,256),
                    amount: $s.numeric,
                    required: ["fromperson","toperson","description","amount"]
                },
                afterinsert : [
                    // TODO : inside the running transaction update balance of from and to person.
                    function(db, element) {
                        var bits = db.bits;
                        var amount = element.amount;
                        var fromguid = element.fromperson;
                        var toguid = element.toperson;
                        var updatefrom = bits.SQL("UPDATE persons SET balance = (balance - ", bits.$(amount), ") where guid = ", bits.$(fromguid));
                        return $u.executeSQL(db,updatefrom).then(function() {
                            var updateto = bits.SQL("UPDATE persons SET balance = (balance + ", bits.$(amount), ") where guid = ", bits.$(toguid));
                            return $u.executeSQL(db,updateto);
                        });
                    }
                ],
                // TODO : Check if updates are blocked.
                afterupdate : [
                    function(db, element) {
                        var deferred = Q.defer();
                        deferred.reject("Updates on transactions are not allowed.");
                        return deferred.promise;
                    }
                ]
            }
        ]
    });

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});