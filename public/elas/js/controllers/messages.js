app.controller('elasMessagesController', function ($scope, $http, $q, elasBackend, $location) {
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
        var names = [];
        for(var i=0; i<persons.length; i++) {
            names.push(persons[i].firstname + ' ' + persons[i].lastname);
        }
        $scope.names = names;
    });

    elasBackend.getListResourcePaged('/messages', {
        communities: communities.join(),
        orderby: 'posted',
        descending: true
    }).then(function(list) {
        var messages = list.results;
        return elasBackend.expand(messages, "person");
    }).then(function(expandedMessages) {
        $scope.messages = expandedMessages;
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
        throw new Error("Unhandled exception");
    };
});

