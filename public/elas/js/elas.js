var app = angular.module('elasApp', ['ngRoute', 'notifications','base64','angular-loading-bar','ui.select']);

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

    elasBackend.getListResourcePaged("/persons", {
        communities: $scope.me.community.href,
        orderby: 'firstname,lastname',
        descending: false
    }).then(function(persons) {
        var names = [];
        for(var i=0; i<persons.length; i++) {
            names.push(persons[i].firstname + ' ' + persons[i].lastname);
        }
        $scope.names = names;
    });

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

    $scope.create = function(formname) {
        if($scope[formname].$valid) {
            $scope.message.person = { href: $scope.me.$$meta.permalink };
            $scope.message.community = $scope.me.community;
            elasBackend.createResource('messages', $scope.message)
                .then(function ok(resp) {
                    var cache = $cacheFactory.get('$http');
                    cache.removeAll();
                    $location.path("/messages.html");
                }, function failed(err) {
                    console.log(err);
                });
        }
    }

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

app.filter('propsFilter', function() {
    return function(items, props) {
        var out = [];

        if (angular.isArray(items)) {
            items.forEach(function(item) {
                var itemMatches = false;

                var keys = Object.keys(props);
                for (var i = 0; i < keys.length; i++) {
                    var prop = keys[i];
                    var text = props[prop].toLowerCase();
                    if (item[prop].toString().toLowerCase().indexOf(text) !== -1) {
                        itemMatches = true;
                        break;
                    }
                }

                if (itemMatches) {
                    out.push(item);
                }
            });
        } else {
            // Let the output be the input untouched
            out = items;
        }

        return out;
    }
});

app.controller('elasNewTransactionController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    $scope.person = {};
    /*$scope.people = [
        { name: 'Adam',      email: 'adam@email.com',      age: 10 },
        { name: 'Amalie',    email: 'amalie@email.com',    age: 12 },
        { name: 'Wladimir',  email: 'wladimir@email.com',  age: 30 },
        { name: 'Samantha',  email: 'samantha@email.com',  age: 31 },
        { name: 'Estefanía', email: 'estefanía@email.com', age: 16 },
        { name: 'Natasha',   email: 'natasha@email.com',   age: 54 },
        { name: 'Nicole',    email: 'nicole@email.com',    age: 43 },
        { name: 'Adrian',    email: 'adrian@email.com',    age: 21 }
    ];*/
    elasBackend.getListResourcePaged("/persons", {
        communities: $scope.me.community.href,
        orderby: 'firstname,lastname',
        descending: false
    }).then(function(persons) {
        $scope.people = persons.results;
        for(var i=0; i<$scope.people.length; i++) {
            var current = $scope.people[i];
            if(current.$$meta.permalink === $scope.me.$$meta.permalink) {
                $scope.people.splice(i,1);
                break;
            }
        }
        console.log(persons);
    });

    $scope.transaction = { fromperson: {}, toperson: {} };

    $scope.create = function(formname) {
        if($scope[formname].$valid) {
            $scope.transaction.fromperson = { href: $scope.me.$$meta.permalink };
            $scope.transaction.toperson = { href: $scope.person.selected.$$meta.permalink };
            console.log($scope.transaction);
            elasBackend.createResource('transactions', $scope.transaction)
                .then(function ok(resp) {
                    var cache = $cacheFactory.get('$http');
                    cache.removeAll();
                    $location.path("/transactions.html");
                }, function failed(err) {
                    console.log(err);
                });
        }
    }

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
            when('/new_transaction.html', {
                templateUrl: 'new_transaction.html',
                controller: 'elasNewTransactionController'
            }).
            otherwise({
                redirectTo: '/#/'
            });
    }]);

