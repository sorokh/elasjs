var app = angular.module('elasApp', ['ngRoute','angular-flexslider', 'notifications']);

app.controller('elasController', function ($scope) {
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
    $scope.loggedIn = true;

    var logonForm = {};
    $scope.logonForm = logonForm;
});

app.controller('elasMessagesController', function ($scope, $http, $q, elasBackend) {
    elasBackend.getListResourcePaged('/messages')
    .then(function(list) {
        var promises = [];
        angular.forEach(list.results, function(message,key) {
            promises.push(elasBackend.expandPerson(message, 'person'));
        });
        $q.all(promises)
            .then(function(result) {
                $scope.messages = result;
            });
    });
});

app.controller('elasMembersController', function($scope, $http, $q, elasBackend) {
    elasBackend.getListResourcePaged("/persons")
        .then(function(list) {
        $scope.persons = list.results;
    });
});

app.controller('elasTransactionsController', function($scope, $http, $q, elasBackend) {
    elasBackend.getListResourcePaged('/transactions')
        .then(function(list) {
            var promises = [];
            angular.forEach(list.results, function(transaction,key) {
                promises.push(elasBackend.expandPerson(transaction, 'fromperson'));
                promises.push(elasBackend.expandPerson(transaction, 'toperson'));
            });
            $q.all(promises)
                .then(function(result) {
                    $scope.transactions = list.results;
                });
        });
});

app.controller('elasLoginController', function ($scope, $http) {
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

