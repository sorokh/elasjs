// TODO : Add server-side error logging/messaging
app.controller('elasEditPersonController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory, $routeParams, $rootScope) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    $scope.permalink = $routeParams.person;
    if($scope.permalink) {
        elasBackend.getResource($scope.permalink).then(function(person) {
            $scope.person = person;
        });
    } else {
        $scope.person = {};
    }

    $scope.createOrUpdate = function(formname) {
        if($scope[formname].$valid) {
            $scope.person.community = $scope.me.community;
            var batch = [];
            batch.push({
                href: $scope.person.$$meta.permalink,
                verb: "PUT",
                body: $scope.person
            });

            angular.forEach($scope.interletssettings, function(ils) {
                batch.push({
                    href : ils.$$meta.permalink,
                    verb : "PUT",
                    body : ils
                });
            });

            elasBackend.batch(batch)
                .then(function ok(resp) {
                    var cache = $cacheFactory.get('$http');
                    cache.removeAll();
                    elasBackend.removePersonFromExpandCache($scope.person.$$meta.permalink);

                    return loadMe($http, $rootScope, elasBackend);
                }).then(function() {
                    $location.path("/messages.html");
                }).catch(function(err) {
                    // TODO : Error handling.
                    cl(err);
                });
        }
    };

    $scope.errClass = function(formname,fieldname) {
        var hasError = $scope.errShow(formname,fieldname);
        if(hasError) {
            return 'has-error';
        } else {
            return '';
        }
    };

    $scope.errShow = function(formname,fieldname) {
        var hasError = $scope[formname][fieldname].$invalid && $scope[formname][fieldname].$touched;
        if(hasError) {
            return true;
        } else {
            return false;
        }
    };

    return elasBackend.getListResourcePaged("/interletssettings", {person: $scope.me.$$meta.permalink}).then(function(ils) {
        $scope.interletssettings = ils.results;
        return elasBackend.expand($scope.interletssettings, ['interletsapproval']);
    }).then(function() {
        var approvals = [];
        for (var i = 0; i < $scope.interletssettings.length; i++) {
            approvals.push($scope.interletssettings[i].interletsapproval.$$expanded);
        }
        return elasBackend.expand(approvals, ['approved']);
    });
});
