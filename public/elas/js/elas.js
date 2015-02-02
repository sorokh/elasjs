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
        $location.url("/");
    };
});

app.controller('elasTransactionsController', function($scope, $http, $q, elasBackend, $location) {
    elasBackend.getListResourcePaged('/transactions', {
        communities: $scope.me.community.href,
        orderby : 'transactiontimestamp',
        descending : true,
        limit : 100
    }).then(function(list) {
            var promises = [];
            angular.forEach(list.results, function(transaction,key) {
                promises.push(elasBackend.expand(transaction, 'fromperson'));
                promises.push(elasBackend.expand(transaction, 'toperson'));
            });
            $q.all(promises)
                .then(function(result) {
                    $scope.transactions = list.results;
                });
        });
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
        var hasError = $scope.errShow(formname, fieldname);
        if(hasError) {
            return 'has-error';
        } else {
            return '';
        }
    };

    $scope.errShow = function(formname,fieldname) {
//        var hasError = $scope[formname][fieldname].$invalid && $scope[formname][fieldname].$fieldleft;
        var hasError = $scope[formname][fieldname].$invalid && $scope[formname][fieldname].$touched;
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
            when('/register.html', {
                templateUrl: 'register.html',
                controller: 'elasRegisterController'
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
    }]).run(['$rootScope', '$location', '$http', '$base64',
    function ($rootScope, $location, $http, $base64) {
        function is_public_url($location) {
            if($location.path() == '/edit_community.html') {
                return true;
            } else if($location.path() == '/register.html') {
                return true;
            }
        }

        $rootScope.$on('$locationChangeStart', function (event, next, current) {
            if(!is_public_url($location)) {
                var authentication = $http.defaults.headers.common.Authorization;
                if($location.path() !== '/' && !(authentication && authentication.indexOf("Basic ") == 0)) {
                    var back_to_url = $location.url();

                    $location.url('/');
                    if(back_to_url) {
                        $location.search('back_to_url', back_to_url);
                    }
                }
            }
        });
    }]);

app.factory('$exceptionHandler', ['$log', function($log) {
    return function(exception, cause) {
        var o = {};
        if(exception && exception.message) {
            o.message = exception.message;
        }
        if(exception && exception.stack) {
            o.stack = exception.stack;
        }

        $log.error.apply($log, [exception, cause]);
        $.ajax({
            url: '/log',
            type: 'PUT',
            data: JSON.stringify(o),
            contentType: 'application/json',
            success: function(result) {
                cl("Unhandled exception has been sent to /log.");
            }
        });
    };
}]);