var Q = require("q");
var mandrill = require('mandrill-api/mandrill');
var CronJob = require('cron').CronJob;

var cl = function(x) {
    console.log(x);
};

/* express.js application, configuration for roa4node */
exports = module.exports = {
    run: function() {
        var mandrill_client = new mandrill.Mandrill();
        var message = {
            "html": "<p>Example <b>HTML</b> content</p>",
            "text": "Mandrill",
            "subject": "Test Mailing through Mandrill",
            "from_email": "elasng@gmail.com",
            "from_name": "Elas-NG",
            "to": [{
                "email": "dimitry_dhondt@yahoo.com",
                "name": "Dimitry D'hondt",
                "type": "to"
            }],
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
