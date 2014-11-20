app.controller('elasEditPersonController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory, $routeParams) {
    if(!$scope.authenticated()) {
        $location.path("/");
        return;
    }

    $scope.permalink = $routeParams.person;
    cl($scope.permalink);
    if($scope.permalink) {
        elasBackend.getResource($scope.permalink).then(function(person) {
            $scope.person = person;
        });
    } else {
        $scope.person = {};
    }

    elasBackend.getListResourcePaged(
        "/interletsApprovals",
        {approved: $scope.me.community.href}
    ).then(function(ilas) {
        return elasBackend.expand(ilas.results, ['community']);
    }).then(function(ilas) {
        $scope.interletsApprovals = ilas;
            cl(ilas);
    });

    $scope.selection = {};
    $scope.selection[$scope.me.community.href] = true;

    $scope.createOrUpdate = function(formname) {
        if($scope[formname].$valid) {
            $scope.person.community = $scope.me.community;
            elasBackend.createOrUpdateResource('persons', $scope.person)
                .then(function ok(resp) {
                    var cache = $cacheFactory.get('$http');
                    cache.removeAll();
                    elasBackend.removePersonFromExpandCache($scope.person.$$meta.permalink);
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
