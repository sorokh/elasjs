var app = angular.module('elasApp', ['ngRoute', 'notifications','base64','angular-loading-bar']);

app.directive('ngFocus', [function() {
    var FOCUS_CLASS = "ng-focused";
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, element, attrs, ctrl) {
            ctrl.$focused = false;
            element.bind('focus', function(evt) {
                element.addClass(FOCUS_CLASS);
                scope.$apply(function() {ctrl.$focused = true;});
            }).bind('blur', function(evt) {
                element.removeClass(FOCUS_CLASS);
                scope.$apply(function() {ctrl.$focused = false;});
            });
        }
    }
}]);

app.controller('elasController', function ($scope, $base64, $http, $location) {
    $scope.authenticated = function() {
        var authentication = $http.defaults.headers.common.Authorization;
        if(authentication && authentication.indexOf("Basic ") == 0) {
            return true;
        }
        return false;
    };

    $scope.logout = function() {
        delete $http.defaults.headers.common.Authorization;
        $location.path("/");
    };
});

app.controller('elasMessagesController', function ($scope, $http, $q, elasBackend, $location) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    elasBackend.getListResourcePaged('/messages', {
        communities: $scope.me.community.href,
        orderby: 'posted',
        descending: true
    }).then(function(list) {
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

var initPersons = function($scope, elasBackend) {
    elasBackend.getListResourcePaged("/persons", {
        communities: $scope.me.community.href,
        orderby: 'firstname,lastname',
        descending: false
    }).then(function(persons) {
        elasBackend.initExpandPerson(persons);
    });
}

app.controller('elasMembersController', function($scope, $http, $q, elasBackend, $location) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    elasBackend.getListResourcePaged("/persons", {
        communities: $scope.me.community.href,
        orderby: 'firstname,lastname',
        descending: false
    }).then(function(persons) {
        $scope.persons = persons.results;
    });
});

app.controller('elasTransactionsController', function($scope, $http, $q, elasBackend, $location) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    elasBackend.getListResourcePaged('/transactions', {
        communities : $scope.me.community.href,
        limit :100
    }).then(function(list) {
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

app.controller('elasLoginController', function ($scope, $http, $base64, $location, $rootScope, elasBackend) {
    $scope.email = 'sabinedewaele@email.be';
    $scope.password = 'sabine';
    $scope.doLogin = function() {
        var header = 'Basic ' + $base64.encode($scope.email + ":" + $scope.password);
        $http.get('/me', {headers: {'Authorization' : header}})
            .then(function ok(resp) {
                var me = resp.data;
                $http.defaults.headers.common.Authorization = header;
                $rootScope.me = me;
                // Initialize persons of this group, to speed up client-side expansion.
                initPersons($scope,elasBackend);
                $location.path("/messages.html");
            }, function fail() {
                console.log("Authentication failed.");
            });
    }
});

app.controller('elasRegisterNewCommunityController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory) {
    $scope.community = {};
    $scope.save = function(formname) {
        console.log($scope.community);
        elasBackend.createResource('communities', $scope.community)
            .then(function ok(resp) {
                var cache = $cacheFactory.get('$http');
                cache.removeAll();
                $scope.community = {};
                $scope.saved = true;
                $scope[formname].$setPristine();
            }, function failed(err) {
                console.log(err);
            });
    };

    $scope.errClass = function(formname,fieldname) {
        var hasError = $scope[formname][fieldname].$invalid && !$scope[formname][fieldname].$pristine && !$scope[formname][fieldname].$focused;
        if(hasError) {
            return 'has-error';
        } else {
            return '';
        }
    }

    $scope.errShow = function(formname,fieldname) {
        var hasError = $scope[formname][fieldname].$invalid && !$scope[formname][fieldname].$pristine && !$scope[formname][fieldname].$focused;
        if(hasError) {
            return true;
        } else {
            return false;
        }
    }
});

app.controller('elasNewMessageController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    $scope.message = {};

    $scope.create = function() {
        $scope.message.person = { href: $scope.me.$$meta.permalink };
        $scope.message.community = $scope.me.community;
        console.log($scope.message);
        elasBackend.createResource('messages', $scope.message)
            .then(function ok(resp) {
                var cache = $cacheFactory.get('$http');
                cache.removeAll();
                $location.path("/messages.html");
            }, function failed(err) {
                console.log(err);
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
            when('/register_new_community.html', {
                templateUrl: 'register_new_community.html',
                controller: 'elasRegisterNewCommunityController'
            }).
            when('/new_message.html', {
                templateUrl: 'new_message.html',
                controller: 'elasNewMessageController'
            }).
            otherwise({
                redirectTo: '/#/'
            });
    }]);

