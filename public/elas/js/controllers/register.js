// TODO : Add server-side error logging/messaging
app.controller('elasRegisterController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory, $routeParams, $rootScope, $anchorScroll) {
    $scope.person = {};
    
    if($routeParams.community) {
        elasBackend.getResource($routeParams.community).then(function(community) {
            $scope.community = community;
        });
    }

    $scope.register = function(formname) {
        alert("registered");
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
});
