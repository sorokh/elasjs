var app = angular.module('testApp', ['ngRoute']);

var extrapersonguid = generateUUID();
var extracommunityguid = generateUUID();
var extramessageguid = generateUUID();

function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x7|0x8)).toString(16);
    });
    return uuid;
};

app.controller('testController', function ($scope, $http) {
    $scope.insertMessage = function() {
        var body = {
            "person": { href : "/persons/9abe4102-6a29-4978-991e-2a30655030e6" },
            "posted": "2014-10-29T02:05:06.000Z",
            "type": "request",
            "title": "Title van de vraag.",
            "description": "Ik vraag ...",
            "amount": 20,
            "unit": "uur",
            "community": {href: "/communities/" + extracommunityguid}
        };

        $http.put("/messages/" + extramessageguid, body);
    };

    $scope.updateMessage = function() {
        var body = {
            "person": { href: "/persons/9abe4102-6a29-4978-991e-2a30655030e6" },
            "type": "request",
            "title": "Title van de vraag.",
            "description": "Ik vraag ...",
            "amount": 20,
            "unit": "uur",
            "community": {href: "/communities/" + extracommunityguid}
        };

        $http.put("/messages/" + extramessageguid, body);
    };

    $scope.insertCommunity = function() {
        var body = {
            "name": "Test group " + Math.random(),
            "street": "Fabrieksstraat",
            "streetNumber": "31",
            "zipcode": "9280",
            "city": "Lebbeke",
            "phone": "0492792059",
            "email": "dimitry_dhondt@yahoo.com"
        };

        $http.put("/communities/" + extracommunityguid, body);
    };

    $scope.insertPerson = function() {
        var body = {
            "firstname": "John",
            "lastName": "Doe",
            "street": "Fabrieksstraat",
            "streetNumber": "31",
            "zipcode": "9280",
            "city": "Lebbeke",
            "phone": "0492792059",
            "email": "dimitry_dhondt@yahoo.com",
            "balance": 0,
            "community": { href: "/communities/" + extracommunityguid }
        };

        $http.put("/persons/" + extrapersonguid, body);
    };
});