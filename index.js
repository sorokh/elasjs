// External includes
var express = require('express');
var bodyParser = require('body-parser');
var Q = require("q");

// Local includes
var roa = require("./roa4node.js");
var oninsert = oninsert;
var onupdate = onupdate;
var onread = onread;
var schema = schema;

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
                    streetbus: { onread: onread.removeifnull },
                    zipcode: {},
                    city: {},
                    phone: { onread: onread.removeifnull },
                    email: { onread: onread.removeifnull },
                    balance: {
                        oninsert: oninsert.value(0),
                        onupdate: onupdate.remove
                    },
                    community: {references: '/communities'}
                },
                // When a PUT operation is executed there are 2 phases of validate.
                // Validation phase 1 is schema validation.
                schema: {
                    $schema: "http://json-schema.org/schema#",
                    firstname: schema.string(1,128),
                    lastname: schema.string(1,128),
                    street: schema.string(1,256),
                    streetnumber: schema.string(1,16),
                    streetbus: schema.string(1,16),
                    zipcode: schema.zipcode,
                    city: schema.string(1,64),
                    phone: schema.phone,
                    email: schema.email,
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
                query: {
                    communities: filterOnCommunities
                },
                // After any update a hook 'afterupdate' can be registered to perform desired things, like clear a cache, ...
                afterupdate: function (person) {
                    roa.clearPasswordCache();
                }
            },
            {
                type: "/messages",
                public: false,
                map: {
                    person: {references: '/persons'},
                    posted: {
                        oninsert: oninsert.now,
                        onupdate: oninsert.now
                    },
                    type: {},
                    title: {},
                    description: { onread: onread.removeifnull },
                    amount: { onread: onread.removeifnull },
                    unit: { onread: onread.removeifnull },
                    community: {references: "/communities"}
                },
                schema: {
                    $schema: "http://json-schema.org/schema#",
                    person: schema.permalink("/persons"),
                    type: {
                        type: "string",
                        description: "Is this message offering something, or is it requesting something ?",
                        enum: ["offer","request"]
                    },
                    title: schema.string(1,256),
                    description: schema.string(0,1024),
                    amount: schema.numeric,
                    unit: schema.string(0,32),
                    community: schema.permalink("/communities"),
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
                    streetbus: { onread: onread.removeifnull },
                    zipcode: {},
                    city: {},
                    // Only allow create/update to set adminpassword, never show on output.
                    adminpassword: { onread: onread.remove },
                    phone: { onread: onread.removeifnull },
                    email: {},
                    facebook: { onread: onread.removeifnull },
                    website: { onread: onread.removeifnull },
                    currencyname: {}
                },
                schema: {
                    $schema: "http://json-schema.org/schema#",
                    name: schema.string(1,256),
                    street: schema.string(1,256),
                    streetnumber: schema.string(1,16),
                    streetbus: schema.string(1,16),
                    zipcode: schema.zipcode,
                    city: schema.string(1,64),
                    phone: schema.phone,
                    email: schema.email,
                    adminpassword: schema.string(5,64),
                    website: schema.url,
                    facebook: schema.url,
                    currencyname: schema.string(1,32),
                    required: ["name", "street", "streetnumber", "zipcode", "city", "phone", "email", "adminpassword", "currencyname"]
                },
                validate: [ validateCommunities ]
            },
            {
                type: "/transactions",
                public: false,
                map: {
                    transactiontimestamp: {
                        oninsert: oninsert.now,
                        onupdate: onupdate.now
                    },
                    fromperson: {references: '/persons'},
                    toperson: {references: '/persons'},
                    description: {},
                    amount: {}
                },
                schema: {
                    $schema: "http://json-schema.org/schema#",
                    transactiontimestamp: schema.timestamp,
                    fromperson: schema.permalink("/persons"),
                    toperson: schema.permalink("/persons"),
                    description: schema.string(1,256),
                    amount: schema.numeric,
                    required: ["fromperson","toperson","description","amount"]
                }
            }
        ]
    });

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});