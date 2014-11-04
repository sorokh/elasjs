var express = require('express');
var bodyParser = require('body-parser');
var Q = require("q");
var roa4node = require("./roa4node.js");
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

var config = {
    logsql : true,
    resources : [
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
            afterupdate: function (person) {
                roa4node.clearPasswordCache();
            }
        },
        {
            type: "/messages",
            public: false,
            map: {
                person: {references: '/persons'},
                posted: {
                    onInsert: function (input) {
                        return new Date().toISOString();
                    },
                    onUpdate: function (input) {
                        return new Date().toISOString();
                    }
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
                adminpassword: {onlyinput: true},
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
                required: ["name", "street", "streetnumber", "zipcode", "city", "phone", "email", "adminpassword", "currencyname"]
            },
            validate: validateCommunities
        },
        {
            type: "/transactions",
            public: false,
            map: {
                transactiontimestamp: {
                    onInsert: function (input) {
                        return new Date().toISOString();
                    },
                    onUpdate: function (input) {
                        return new Date().toISOString();
                    }
                },
                fromperson: {references: '/persons'},
                toperson: {references: '/persons'},
                description: {},
                amount: {}
            },
            schema: {}
        }
    ]
}

// Configure REST API, add all handlers and middleware to express.js application.
roa4node.configure(app, config);

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});
