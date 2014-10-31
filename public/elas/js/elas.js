var app = angular.module('elasApp', ['ngRoute','angular-flexslider', 'notifications','base64']);

var initPersonsUrl = "/persons?communities=%2Fcommunities%2F8bf649b4-c50a-4ee9-9b02-877aa0a71849";

app.controller('elasController', function ($scope, $base64) {
    $scope.flexSlides = [];
    $scope.flexSlides.push({
        image : "img/photos/1.jpg",
        title : "Gemeenschapsmunt",
        para : "Korte beschrijving..."
    });
    $scope.flexSlides.push({
        image : "img/photos/2.jpg",
        title : "Informatie",
        para : "Even kort toelichten..."
    });
    $scope.flexSlides.push({
        image : "img/photos/3.jpg",
        title : "Titel",
        para : "..."
    });
});

app.controller('elasMessagesController', function ($scope, $http, $q, elasBackend) {
    elasBackend.getListResourcePaged('/messages?communities=%2Fcommunities%2F8bf649b4-c50a-4ee9-9b02-877aa0a71849')
    .then(function(list) {
        var promises = [];
        angular.forEach(list.results, function(message,key) {
            promises.push(elasBackend.expandPerson(message, 'person', initPersonsUrl));
        });
        $q.all(promises)
            .then(function(result) {
                $scope.messages = result;
            });
    });
});

app.controller('elasMembersController', function($scope, $http, $q, elasBackend) {
    elasBackend.getListResourcePaged("/persons?communities=%2Fcommunities%2F8bf649b4-c50a-4ee9-9b02-877aa0a71849")
        .then(function(list) {
        $scope.persons = list.results;
    });
});

app.controller('elasTransactionsController', function($scope, $http, $q, elasBackend) {
    elasBackend.getListResourcePaged('/transactions?communities=%2Fcommunities%2F8bf649b4-c50a-4ee9-9b02-877aa0a71849&limit=100')
        .then(function(list) {
            var promises = [];
            angular.forEach(list.results, function(transaction,key) {
                promises.push(elasBackend.expandPerson(transaction, 'fromperson', initPersonsUrl));
                promises.push(elasBackend.expandPerson(transaction, 'toperson', initPersonsUrl));
            });
            $q.all(promises)
                .then(function(result) {
                    $scope.transactions = list.results;
                });
        });
});

app.controller('elasLoginController', function ($scope, $http, $base64, $location) {
    $scope.email = 'sabinedewaele@email.be';
    $scope.password = 'sabine';
    $scope.doLogin = function() {
        console.log("logon()");
        var header = 'Basic ' + $base64.encode($scope.email + ":" + $scope.password);
        console.log(header);
        $http.get('/me', {headers: {'Authorization' : header}})
            .then(function ok(resp) {
                var me = resp.data;
                $http.defaults.headers.common.Authorization = header;
                console.log("OK - authentication header set on all subsequent http requests.");
                console.log(me);
                $location.path("/messages.html");
            }, function fail() {
                console.log("FAIL");
            });
    }
});

app.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.
            when('/', {
                templateUrl: 'login.html',
                controller: 'elasLoginController'
            }).
            when('/messages.html', {
                templateUrl: 'messages.html',
                controller: 'elasMessagesController'
            }).
            when('/members.html', {
                templateUrl: 'members.html',
                controller: 'elasMembersController'
            }).
            when('/transactions.html', {
                templateUrl: 'transactions.html',
                controller: 'elasTransactionsController'
            }).
            when('/contact.html', {
                templateUrl: 'contact.html'
            }).
            otherwise({
                redirectTo: '/#/'
            });
    }]);

