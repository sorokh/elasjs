var app = angular.module('letsApp', ['ngRoute','angular-flexslider']);

app.controller('letsController', function ($scope) {
    $scope.flexSlides = [];
    $scope.flexSlides.push({
        image : "img/photos/1.jpg",
        title : "Gemeenschapsmunt",
        para : "Korte beschrijving..."
    });
    $scope.flexSlides.push({
        image : "img/photos/2.jpg",
        title : "Informatie",
        para : "Even kort toelichten..."
    });
    $scope.flexSlides.push({
        image : "img/photos/3.jpg",
        title : "Titel",
        para : "..."
    });
    $scope.loggedIn = true;
});

app.controller('calendarController', function ($scope, $http) {
    //https://www.google.com/calendar/ical/01i2d6ret8gq1j24or8urnv7oc%40group.calendar.google.com/public/basic.ics
    //https://www.google.com/calendar/ical/feestdagenbelgie%40gmail.com/public/basic.ics
    $http.get("https://www.google.com/calendar/feeds/feestdagenbelgie%40gmail.com/public/full?orderby=starttime&sortorder=ascending&futureevents=true&alt=json").success(function(cal) {
        $scope.events = [];
        angular.forEach(cal.feed.entry, function(value, key) {
            $scope.events.push({title : value.title.$t, content : value.content.$t, date : value.gd$when[0].startTime });
        });
        console.log($scope.events);
    });
});

app.controller('facebookController', function ($scope, $http) {
    var profileid = "649689358450200"; // EVA Dendermonde profile id.
    var appid = "1526197424288290"; // facebook app, only used to read public page.
    var appsecret = "ee4c2c5eee5508f99b9c3e16c7d7ef34"; // secret for this app. publicly exposed, so don't re-use.

    $http.get("https://graph.facebook.com/oauth/access_token?grant_type=client_credentials&client_id=" + appid + "&client_secret=" + appsecret).success(function(authtoken) {
        $http.get("https://graph.facebook.com/"+profileid+"/feed?" + authtoken).success(function(feed) {
            $scope.posts = [];
            // Filter marked messages for the publication on the website
            angular.forEach(feed.data, function(post, index) {
                if(post.message) {
                    var key = "*";
                    var message = post.message.trim();
                    if(message.indexOf(key, message.length - key.length) !== -1) {
                        post.message = post.message.substr(0,post.message.length - 1);
                        $scope.posts.push(post);
                    }
                }
            });
        });
    });
});

app.controller('elasController', function ($scope, $http) {
    var messages = [];
    messages.push({
        type : "request",
        user : "Sabine De Waele",
        date : "1/10/2014",
        title : "Oppas bij mij thuis op dinsdag 14/10 van 19u tot 22u30.",
        description: "Ik mag naar een vergadering gaan in Dendermonde. Mijn zoontjes (8 en 6) gaan rond 20u15 slapen, daarna kan je dus doen waar je zin in hebt. TV, internet, een boek lezen...",
        price: 15,
        priceUnit: "uur",
    });
    messages.push({
        type : "request",
        user : "Nicole De Gols",
        date : "7/10/2014",
        title : "Wie gaat er binnenkort naar ikea ?",
        description: "Wie wil FIXA zelfklevende meubeldoppen meebrengen ? 20 stuks in 1 verpakking. Er mogen 2 verpakkingen meekomen = in totaal 3 euro.",
    });
    messages.push({
        type : "offer",
        user : "Dimitry D'hondt",
        date : "7/10/2014",
        title : "Vegetarische Kooklessen",
        description: "Ik organiseer, vanuit EVA Dendermonde, een reeks van 6 vegetarische kooklessen. De nadruk ligt op alledaagse, lekkere recepten. Geen moeilijke recepten, en courant beschikbare ingrediënten. Er is beperkt plaats (5 personen). Inschrijven via mail voor 1/11/2014 graag !",
    });
    $scope.messages = messages;

    var members = [];
    members.push({
        firstName : "Sabine",
        lastName : "De Waele",
        street : "Kleinzand",
        streetNumber : "25",
        zipCode : 9280,
        city: "Lebbeke",
        phone: "0495 54 15 22",
        email: "sabinedewaele@email.be"
    });
    members.push({
        firstName : "Nicole",
        lastName : "De Gols",
        street : "Beekveldstraat",
        streetNumber : "1A",
        streetBus: "2",
        zipCode : 9200,
        city: "Grembergen",
        phone: "052 31 82 51",
        email: "nicoledegols@email.be"
    });
    $scope.members = members;

    var transactions = [];
    transactions.push({
        from: "Sabine De Waele",
        to: "Nicole De Gols",
        message: "Prachtige aardperen !",
        date: "1/9/2014"
    });
    transactions.push({
        from: "Sabine De Waele",
        to: "Erik Paredis",
        message: "Lezing op het LETS feest",
        date: "1/10/2014"
    });
    $scope.transactions = transactions;
});

app.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.
            when('/elas/login.html', {
                templateUrl: 'elas/login.html',
                controller: 'elasController'
            }).
            when('/elas/messages.html', {
                templateUrl: 'elas/messages.html',
                controller: 'elasController'
            }).
            when('/elas/members.html', {
                templateUrl: 'elas/members.html',
                controller: 'elasController'
            }).
            when('/elas/transactions.html', {
                templateUrl: 'elas/transactions.html',
                controller: 'elasController'
            }).
            when('/contact.html', {
                templateUrl: 'contact.html'
            }).
            when('/calendar.html', {
                templateUrl: 'calendar.html',
                controller: 'calendarController'
            }).
            when('/', {
                templateUrl: 'root.html',
                controller: 'facebookController'
            }).
            otherwise({
                redirectTo: '/#/'
            });
    }]);

