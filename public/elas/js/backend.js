angular.module('elasApp').factory('elasBackend', ['$http', '$q', '$notification', function($http, $q, $notification) {
    var that = {};

    var generateGUID = function(){
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x7|0x8)).toString(16);
        });
        return uuid;
    };

    /* Retrieve a single resource */
    that.getResource = function (href, params) {
        params = params || {};
        var d = $q.defer();
        $http({
            method: "GET",
            url: href,
            params: params,
            cache: true
        }).success(function (resp) {
                hrefToResource[resp.$$meta.permalink];
                d.resolve(resp);
            }).error(function (error) {
                if(error.status === 403) {
                    $notification.error('Geen Rechten', 'U hebt onvoldoende rechten tot '+href);
                } else if(error.status === 404) {
                    $notification.error('Niet gevonden', href+' kon niet worden gevonden');
                } else if(error.status === 500) {
                    $notification.error('Connectie Probleem', 'Er is een interne fout opgetreden op de server van '+href);
                } else if(error.status === 502 || error.status === 504){
                    $notification.error('Connectie Probleem', 'De server van '+href+' is niet beschikbaar.');
                } else {
                    $notification.error('Connectie Probleem', 'Er is een probleem met de VSKO-services voor '+href);
                }
                d.reject(error);
            });
        return d.promise;
    };

    var getAllFromResults = function(data) {
        var defer = $q.defer();
        var results = [];
        for(var i = 0; i < data.results.length; i++) {
            results.push(data.results[i].$$expanded);
        }

        if (data.$$meta.next) {
            that.getResource(data.$$meta.next).then(function (next) {
                getAllFromResults(next).then(function (next_results) {
                    results = results.concat(next_results);
                    defer.resolve(results);
                });
            }, function(error) {
                // TODO : Error notification to the user ?
                // or send to /log...
                defer.reject(error);
            });
        } else {
            defer.resolve(results);
        }

        return defer.promise;
    };

    /* Retrieve a list resource (single page)
    that.getListResource = function (url, params, cancelPromise) {
        var d = $q.defer();
        $http({
            method: "GET",
            url: url,
            params: params,
            cache: true,
            timeout: cancelPromise
        }).success(function(resp) {
                var results = [];
                for(var i = 0; i < resp.results.length; i++) {
                    results.push(resp.results[i].$$expanded);
                }
                d.resolve({results: results, meta: resp.$$meta});
            }).error(function(error) {
                // TODO : Error to the user ? Or /log
                if(error.status === 403) {
                    $notification.error('Geen Rechten', 'U hebt onvoldoende rechten tot '+url);
                } else if(error.status === 404) {
                    $notification.error('Niet gevonden', href+' kon niet worden gevonden');
                } else if(error.status === 500) {
                    $notification.error('Connectie Probleem', 'Er is een interne fout opgetreden op de server van '+url);
                } else if(error.status === 502 || error.status === 504){
                    $notification.error('Connectie Probleem', 'De server van '+url+' is niet beschikbaar.');
                } else {
                    $notification.error('Connectie Probleem', 'Er is een probleem met de VSKO-services voor '+url);
                }
                d.reject(error);
            });

        return d.promise;
    };*/

    /* Retrieve a list resource, perform paging to get all pages */
    that.getListResourcePaged = function (url, params, cancelPromise) {
        var d = $q.defer();
        $http({
            method: "GET",
            url: url,
            params: params,
            cache: true,
            timeout: cancelPromise
        }).success(function(resp) {
                getAllFromResults(resp).then(function (allResults) {
                    // Add individual resources to resource cache.
                    angular.forEach(allResults, function(element) {
                        if(element.$$meta && element.$$meta.permalink) {
                            hrefToResource[element.$$meta.permalink] = element;
                        }
                    });
                    d.resolve({results: allResults, meta: resp.$$meta});
                });
            }).error(function(error) {
                // TODO : Error to the user ? or /log ? Or generic message + /log
                if(error.status === 403) {
                    $notification.error('Geen Rechten', 'U hebt onvoldoende rechten tot '+url);
                } else if(error.status === 404) {
                    $notification.error('Niet gevonden', url+' kon niet worden gevonden');
                } else if(error.status === 500) {
                    $notification.error('Connectie Probleem', 'Er is een interne fout opgetreden op de server van '+url);
                } else if(error.status === 502 || error.status === 504){
                    $notification.error('Connectie Probleem', 'De server van '+url+' is niet beschikbaar.');
                } else {
                    $notification.error('Connectie Probleem', 'Er is een probleem met de VSKO-services voor '+url);
                }
                d.reject(error);
            });

        return d.promise;
    };

    that.createOrUpdateResource = function (type, resource) {
        var defer = $q.defer();
        var url;
        if(resource.$$meta && resource.$$meta.permalink) {
            url = resource.$$meta.permalink;
        } else {
            url = '/' + type + '/' + generateGUID();
        }

        $http({
            method: 'PUT',
            url: url,
            data: resource,
            contentType: 'application/json',
            dataType: 'json'
        }).success(function(data, status) {
            var resp = {
                status: status
            };

            // Remove from expand cache.
            delete hrefToResource[url];

            defer.resolve(resp);
        }).error(function(error) {
            cl("createOrUpdateResource failed, rejecting promise.");
                // TODO : Root error, send to /log + message to the user...
            defer.reject(error);
        });

        return defer.promise;
    };

    that.updateResource = function (resource) {
        var defer = $q.defer();

        $http({
            method: 'PUT',
            url: resource.$$meta.permalink,
            data: resource,
            contentType: 'application/json',
            dataType: 'json'
        }).success(function(data, status) {
            var resp = {
                status: status
            };

            // Remove from expand cache.
            delete hrefToResource[resource.$$meta.permalink];

            defer.resolve(resp);
        }).error(function(resp) {
            defer.reject(resp);
        });

        return defer.promise;
    };

    that.deleteResource = function(resource) {
        var defer = $q.defer();

        $http({
            method: 'DELETE',
            url: resource.$$meta.permalink
        }).success(function (data, status) {
            var resp = {
                status: status
            };

            // Remove from expand cache.
            delete hrefToResource[resource.$$meta.permalink];

            defer.resolve(resp);
        }).error(function(resp) {
            var resp = {
                status: status
            };
            defer.reject(resp);
        });

        return defer.promise;
    };

    that.batch = function(batch) {
        var defer = $q.defer();

        $http({
            method: 'PUT',
            url: '/batch',
            data: batch,
            contentType: 'application/json',
            dataType: 'json'
        }).success(function (data, status) {
            var resp = {
                status: status
            };

            // Remove from expand cache.
            for(var i=0; i<batch.length; i++) {
                delete hrefToResource[batch[i].href];
            }

            defer.resolve(resp);
        }).error(function(resp) {
            var resp = {
                status: status
            };
            defer.reject(resp);
        });

        return defer.promise;
    };

    var toArray = function(list) {
        var ret = {};

        angular.forEach(list.results, function(value, key) {
            ret[value.$$meta.href] = value;
        });

        return ret;
    };

    var hrefToResource = {};

    expandOne = function(resource, key) {
        var defer = $q.defer();

        var cached = hrefToResource[resource[key].href];
        if(!cached) {
            that.getResource(resource[key].href)
                .then(function(data) {
                    resource[key].$$expanded = data;
                    hrefToResource[resource[key].href] = data;
                    defer.resolve(resource);
                }, function(error) {
                    // TODO
                });
        } else {
            resource[key].$$expanded = cached;
            defer.resolve(resource);
        }

        return defer.promise;
    };

    // Do client-side expansion (with local caching) on a list of resources, for one or more keys.
    that.expand = function(resources, keys) {
        var promises = [];

        if(!(resources instanceof Array)) {
            resources = [resources];
        }

        if(!(keys instanceof Array)) {
            keys = [keys];
        }

        angular.forEach(resources, function(resource) {
            angular.forEach(keys, function(key) {
                promises.push(expandOne(resource,key));
            });
        });

        return $q.all(promises);
    };

    return that;
}]);