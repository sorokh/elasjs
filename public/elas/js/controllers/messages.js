app.controller('elasMessagesController', function ($scope, $http, $q, elasBackend, $location) {
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

    var communities = [];
    communities.push($scope.me.community.href);
    var ils = $scope.me.$$interletssettings;
    for(var i=0; i<ils.length; i++) {
        if(ils[i].active) {
            communities.push(ils[i].interletsapproval.$$expanded.approved.href);
        }
    }

    elasBackend.getListResourcePaged('/messages', {
        communities: communities.join(),
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

    $scope.select = function(message) {
        $scope.selectedMessage = message;
    };

    $scope.deleteSelected = function() {
        var message = $scope.selectedMessage;
        elasBackend.deleteResource(message).then(function(data) {
            var index = $scope.messages.indexOf(message);
            if(index != -1) {
                $scope.messages.splice(index,1);
            }
        }, function failed(err) {
            // TODO : Send error report to server.
            cl("DELETE failed.");
            cl(err);
        });
    };

    $scope.ago = function(date) {
        var now = moment(new Date());
        var dateAsMoment = moment(date);
        return dateAsMoment.from(now);
    };

    $scope.isNew = function(message) {
        var lastViewed = getLastViewedDate($scope.me.email);
        if(lastViewed) {
            var m = new Date(message.posted);

            var mt = m.getTime();
            var vt = lastViewed.getTime();

            return mt > vt;
        } else {
            return false;
        }
    };

    $scope.toggle = function(message) {
        message.$$opened = !message.$$opened;
    };
});

