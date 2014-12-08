var Q = require("q");
var mandrill = require('mandrill-api/mandrill');
var CronJob = require('cron').CronJob;
var needle = require('needle');

var cl = function(x) {
    console.log(x);
};

var baseurl = 'http://localhost:5000';
//var baseurl = 'https://sheltered-lowlands-3555.herokuapp.com';
var user = 'sabine@email.be';
var pwd = 'pwd';
var elasurl = baseurl + '/elas';

function httpGet(url, params) {
    var deferred = Q.defer();

    var fullurl = baseurl + url;
    needle.request('get', fullurl, params, { auth: 'basic', username: user, password: pwd }, function(error, response) {
        if (!error && response.statusCode == 200) {
            deferred.resolve(response.body);
        } else {
            cl("Unable to GET " + url);
            cl("Error : ");
            cl(error);
            cl('HTTP Response status code : ' + response.statusCode);
            deferred.reject("Unable to GET " + url);
        }
    });

    return deferred.promise;
}

function sendmail(html, text, subject, fromName, emails) {
    var mandrill_client = new mandrill.Mandrill();
    var message = {
        "html": html,
        "text": text,
        "subject": subject,
        "from_email": "elasng@gmail.com",
        "from_name": fromName,
        "to": [
        ],
        "headers": {
            "Reply-To": "message.reply@example.com"
        }
    };

    for(var i=0; i<emails.length; i++) {
        message["to"].push({
            "email": emails[i],
            "name": emails[i],
            "type": "bcc"
        });
    }

    mandrill_client.messages.send({"message": message, "async": false, "ip_pool": "Main Pool"}, function(result) {
        cl(result);
        /* Example:
         [{
         "email": "recipient.email@example.com",
         "status": "sent",
         "reject_reason": "hard-bounce",
         "_id": "abc123abc123abc123abc123abc123"
         }]
         */
    }, function(e) {
        // TODO : Do proper error handling, like mail this exception to support/development.
        console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
        // Example : A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
    });
}

function generateMailHtml(community, personsByPermalink, messages) {
    var ret = "";

    ret += "<h1>Recent LETS Vraag en Aanbod :</h1>\n\n";
    ret += '<p>Deze mail bevat LETS vraag en aanbod voor <strong>' + community.name + '</strong> dat in de afgelopen 7 dagen is geplaatst. ' +
    'Klik op de naam van de persoon om te e-mailen. ' +
    'Klik op (...) om een bericht te bekijken op <a href="' + elasurl + '">Elas-NG</a>.</p>';


    ret += '<ul>\n';
    for(var i=0; i<messages.length; i++) {
        var msg = messages[i];
        var person = personsByPermalink[msg.person.href];

        ret += '<li><a href="mailto:' + person.email + '">' + person.firstname + ' ' + person.lastname + '</a> : ' +
            msg.title + '&nbsp;&nbsp;<a href="' + elasurl + msg.$$meta.permalink + '">(...)</a></li>\n';
    }

    ret += '</ul>\n';
    return ret;
}

function generateMailText(community, personsByPermalink, messages) {
    return "";
}

/**
 * Determine the email adresses for a given community.
 * All people in the community with mail4elas == true get the emails
 * AND all people (with mail4elas == true), that have interlets active for this community also receive the email.
 */
function determineMailsForCommunity(community, personsByPermalink, interletsSettingsByPermalink, interletsApprovalsByPermalink) {
    var ret = [];

    var persons = mapAsArray(personsByPermalink);
    for(var i=0; i<persons.length; i++) {
        var person = persons[i];
        if(person.community.href == community.$$meta.permalink && person.email && person.mail4elas) {
            ret.push(person.email);
        }
    }

    var interletsApprovals = mapAsArray(interletsApprovalsByPermalink);
    var interletsSettings = mapAsArray(interletsSettingsByPermalink);
    for(var i=0; i<interletsApprovals.length; i++) {
        var interletsApproval = interletsApprovals[i];
        if(interletsApproval.approved.href == community.$$meta.permalink) {
            for(var j=0; j<interletsSettings.length; j++) {
                var interletsSetting = interletsSettings[j];
                if(interletsSetting.interletsapproval.href == interletsApproval.$$meta.permalink && interletsSetting.active) {
                    // This person also needs to get the mail.
                    var person = personsByPermalink[interletsSetting.person.href];
                    if(person && person.email && person.mail4elas) {
                        ret.push(person.email);
                        cl("added " + person.email);
                    }
                }
            }
        }
    }

    //return ret;
    // For testing purposes.
    if(ret.indexOf("sabine@email.be") != -1) {
        return ['dimitry_dhondt@yahoo.com'];
    } else {
        return [];
    }
}

function sendMailRecursive(communities, personsByPermalink, interletsSettingsByPermalink, interletsApprovalsByPermalink) {
    var community = communities.pop();
    if(community) {
        return httpGet('/messages', {communities: community.$$meta.permalink}).then(function (data) {
            var messages = listResourceAsArray(data);

            var html = generateMailHtml(community, personsByPermalink, messages);
            var text = generateMailText(community, personsByPermalink, messages);

            var emails = determineMailsForCommunity(community, personsByPermalink, interletsSettingsByPermalink, interletsApprovalsByPermalink);
            cl("emails : ");
            cl(emails);

            sendmail(html, text, "Vraag & Aanbod " + community.name, community.name, emails);
            sendMailRecursive(communities, personsByPermalink, interletsSettingsByPermalink, interletsApprovalsByPermalink);
        });
    }
}

function mapAsArray(o) {
    var ret = [];

    Object.keys(o).forEach(function(key) {
        var val = o[key];
        ret.push(val);
    });

    return ret;
}

function listResourceAsMap(data) {
    var ret = {};

    for (var i = 0; i < data.results.length; i++) {
        ret[data.results[i].$$expanded.$$meta.permalink] = data.results[i].$$expanded;
    }

    return ret;
}

function listResourceAsArray(data) {
    var ret = [];

    for(var j=0; j<data.results.length; j++) {
        ret.push(data.results[j].$$expanded);
    }

    return ret;
}

/* express.js application, configuration for roa4node */
exports = module.exports = {
    sendMail: function(messagesOlderThan) {
        var communities = [];
        var personsByPermalink = {};
        var interletsSettingsByPermalink = {};
        var interletsApprovalsByPermalink = {};

        cl("Sending mails, older than " + messagesOlderThan);

        httpGet('/communities').then(function(data) {
            for (var i = 0; i < data.results.length; i++) {
                communities.push(data.results[i].$$expanded);
            }
            return httpGet('/persons');
        }).then(function (data) {
            personsByPermalink = listResourceAsMap(data);
            return httpGet('/interletssettings');
        }).then(function (data) {
            interletsSettingsByPermalink = listResourceAsMap(data);
            return httpGet('/interletsapprovals');
        }).then(function (data) {
            interletsApprovalsByPermalink = listResourceAsMap(data);
            return sendMailRecursive(communities, personsByPermalink, interletsSettingsByPermalink, interletsApprovalsByPermalink);
        }).fail(function(error) {
            // TODO : Error handling.
            cl("Error during processing.");
            cl(error);
        });
    },

    run: function() {
        var mandrill_client = new mandrill.Mandrill();
        var message = {
            "html": "<p>Example <b>HTML</b> content</p>",
            "text": "Mandrill",
            "subject": "Test Mailing through Mandrill",
            "from_email": "elasng@gmail.com",
            "from_name": "Elas-NG",
            "to": [
                {
                    "email": "dimitry_dhondt@yahoo.com",
                    "name": "Dimitry D'hondt",
                    "type": "to"
                },
                {
                    "email": "dimitry.dhondt@gmail.com",
                    "name": "Dimitry D'hondt",
                    "type": "cc"
                }
            ],
            "headers": {
                "Reply-To": "message.reply@example.com"
            }
        };

        // Hourly mail..
        new CronJob('0 0 * * * *', function(){
            console.log("Sending test mail...");
            mandrill_client.messages.send({"message": message, "async": false, "ip_pool": "Main Pool"}, function(result) {
                console.log(result);
                /*
                 [{
                 "email": "recipient.email@example.com",
                 "status": "sent",
                 "reject_reason": "hard-bounce",
                 "_id": "abc123abc123abc123abc123abc123"
                 }]
                 */
            }, function(e) {
                // Mandrill returns the error as an object with name and message keys
                console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
                // A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
            });
        }).start();
    }
};
