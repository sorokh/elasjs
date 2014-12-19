var app = angular.module('elasApp', ['ngRoute', 'notifications','base64','angular-loading-bar','ui.select','ngCkeditor','ngSanitize']);

var cl = function(x) {
    console.log(x);
};

var supports_html5_storage = function() {
    try {
        return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
        return false;
    }
};

var lastLogonKey = "elasng.last.logon.dates";

var updateLastLogonDates = function(email) {
    if(supports_html5_storage()) {
        var json = localStorage[lastLogonKey];
        var timestampsPerEmail = {};
        if(json != null) {
            timestampsPerEmail = angular.fromJson(json);
        }
        if(!timestampsPerEmail[email]) {
            timestampsPerEmail[email] = [];
        }
        var timestamps = timestampsPerEmail[email];
        timestamps.unshift(new Date());
        if(timestamps.length > 2) {
            timestamps = timestamps.splice(2,timestamps.length - 2);
        }
        json = angular.toJson(timestampsPerEmail);
        localStorage[lastLogonKey] = json;
    }
};

// Return the last viewed message date. undefined if this is unknown.
var getLastViewedDate = function(email) {
    if(supports_html5_storage()) {
        var json = localStorage[lastLogonKey];
        var timestampsPerEmail = {};
        if(json != null) {
            timestampsPerEmail = angular.fromJson(json);
            if(timestampsPerEmail[email]) {
                var timestamps = timestampsPerEmail[email];
                if(timestamps.length == 2) {
                    return new Date(timestamps[1]);
                }
            }
        }
    }
};

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

function initMe($scope, elasBackend, me) {
    $scope.me = me;

    // And get interletssettings + expand community.
    return elasBackend.getListResourcePaged('/interletssettings', {
        person: me.$$meta.permalink
    }).then(function(ils) {
        $scope.me.$$interletssettings = ils.results;
        return elasBackend.expand(ils.results, "interletsapproval");
    }).then(function() {
        return elasBackend.expand($scope.me, "community");
    });
}

function loadMe($http, $scope, elasBackend) {
    return $http.get('/me')
        .then(function(resp) {
            var me = resp.data;
            return initMe($scope, elasBackend, me);
        });
}


app.controller('elasController', function ($scope, $base64, $http, $location, elasBackend) {
    $scope.editorOptions = {
        language: 'nl',
//        uiColor: '#196b7d'
        uiColor: '#ffffff'
    };

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

app.controller('elasTransactionsController', function($scope, $http, $q, elasBackend, $location) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    elasBackend.getListResourcePaged('/transactions', {
        communities: $scope.me.community.href,
        orderby : 'transactiontimestamp',
        descending : true,
        limit : 100
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
    $scope.email = 'sabine@email.be';
    $scope.password = 'pwd';
    $scope.doLogin = function() {
        var header = 'Basic ' + $base64.encode($scope.email + ":" + $scope.password);
        $http.get('/me', {headers: {'Authorization' : header}})
            .then(function(resp) {
                var me = resp.data;

                $http.defaults.headers.common.Authorization = header;
                // update last logon timestamps
                updateLastLogonDates(me.email);
                return initMe($rootScope, elasBackend, me);
            }, function fail(err){
                console.log("Authentication failed.");
            }).then(function() {
                $location.path("/messages.html");
            });
    };

    $rootScope.interletsCommunityCount = function() {
        var ils = $rootScope.me.$$interletssettings;
        var ret = 0;
        angular.forEach(ils, function(x) {
            if(x.active) ret++;
        });

        return ret;
    };
});

app.controller('elasEditCommunityController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory) {
    $scope.community = {};
    $scope.save = function(formname) {
        console.log($scope.community);
        elasBackend.createOrUpdateResource('communities', $scope.community)
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
    };

    $scope.errShow = function(formname,fieldname) {
        var hasError = $scope[formname][fieldname].$invalid && !$scope[formname][fieldname].$pristine && !$scope[formname][fieldname].$focused;
        if(hasError) {
            return true;
        } else {
            return false;
        }
    }
});

app.controller('elasEditMessageController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory, $routeParams) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    $scope.messagePermalink = $routeParams.message;

    if($scope.messagePermalink) {
        elasBackend.getResource($scope.messagePermalink).then(function(message) {
            $scope.message = message;
        });
    } else {
        $scope.message = {};
    }

    $scope.createOrUpdate = function(formname) {
        if($scope[formname].$valid) {
            $scope.message.person = { href: $scope.me.$$meta.permalink };
            $scope.message.community = $scope.me.community;
            elasBackend.createOrUpdateResource('messages', $scope.message)
                .then(function ok(resp) {
                    var cache = $cacheFactory.get('$http');
                    cache.removeAll();
                    $location.path("/messages.html");
                }, function failed(err) {
                    console.log(err);
                });
        }
    };

    $scope.errClass = function(formname,fieldname) {
        var hasError = $scope[formname][fieldname].$invalid && !$scope[formname][fieldname].$pristine && !$scope[formname][fieldname].$focused;
        if(hasError) {
            return 'has-error';
        } else {
            return '';
        }
    };

    $scope.errShow = function(formname,fieldname) {
        var hasError = $scope[formname][fieldname].$invalid && !$scope[formname][fieldname].$pristine && !$scope[formname][fieldname].$focused;
        if(hasError) {
            return true;
        } else {
            return false;
        }
    };
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
            when('/edit_community.html', {
                templateUrl: 'edit_community.html',
                controller: 'elasEditCommunityController'
            }).
            when('/edit_message.html', {
                templateUrl: 'edit_message.html',
                controller: 'elasEditMessageController'
            }).
            when('/edit_person.html', {
                templateUrl: 'edit_person.html',
                controller: 'elasEditPersonController'
            }).
            when('/new_transaction.html', {
                templateUrl: 'new_transaction.html',
                controller: 'elasNewTransactionController'
            }).
            otherwise({
                redirectTo: '/#/'
            });
    }]);

