app.controller('elasEditMessageController', function ($scope, $http, $base64, $location, elasBackend, $cacheFactory, $routeParams) {
    /*
     $scope.insertText = function() {
     var oEditor = CKEDITOR.instances.description;
     console.log(oEditor);
     var html = "<a>my anchor</a>";

     var newElement = CKEDITOR.dom.element.createFromHtml( html, oEditor.document );
     oEditor.insertElement( newElement );
     };
     */
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
                    $location.url("/messages.html");
                }, function failed(err) {
                    console.log(err);
                });
        }
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
        var hasError = $scope[formname][fieldname].$invalid && $scope[formname][fieldname].$touched;
        if(hasError) {
            return true;
        } else {
            return false;
        }
    };
});

