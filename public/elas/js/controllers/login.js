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
                var back_to_url = $location.search().back_to_url;
                if(back_to_url) {
                    cl("back_to_url");
                    cl(back_to_url);
                    $location.url(back_to_url);
                } else {
                    $location.url("/messages.html");
                }
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

