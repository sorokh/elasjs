var fs = require("fs");

function generate() {
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
};

generate();