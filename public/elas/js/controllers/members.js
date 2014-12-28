app.controller('elasMembersController', function($scope, $http, $q, elasBackend, $location) {
    var communities = [];
    communities.push($scope.me.community.href);
    var ils = $scope.me.$$interletssettings;
    for(var i=0; i<ils.length; i++) {
        if(ils[i].active) {
            communities.push(ils[i].interletsapproval.$$expanded.approved.href);
        }
    }

    elasBackend.getListResourcePaged("/persons", {
        communities: communities.join(),
        orderby: 'firstname,lastname',
        descending: false
    }).then(function(persons) {
        $scope.persons = persons.results;
    });
});
