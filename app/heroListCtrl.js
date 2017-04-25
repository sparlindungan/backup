(function(){

    'use strict';

    //This controller serves to navigate from the hero control page
    //This is part of a library
    //However we have features within it to hide and show as well as clear out our visualizations in between navigation

    var app = angular.module("heroViewer");

    app.controller('heroList', function(
        $scope, $http, getResourcePath, cache, sparkle, background, renderer, animation
    ) {
        if (!cache.has('overview')) {
            $http.get(getResourcePath('heroes/overview_en.json'))
                .success(function(data) {
                    cache.set('overview', data);
                    $scope.heroList = data;
                });
        } else {
            $scope.heroList = cache.get('overview');
        }
        animation.off('frame');
        animation.on('frame', function(deltaTime) {
            background.render(renderer);
            sparkle.render(renderer, deltaTime);
        });

        $scope.hoverHero = {
            title : ""
        }

        $('#InfoOverlay').hide();
        $('#heroGraph').hide().empty();
        $('#heroRoles').hide().empty();
        $('#heroRolesTitle').hide();

        $scope.showHeroName = function(hero) {
            $scope.hoverHero.title = hero.title;
        }
        $scope.hideHeroName = function(hero) {
            $scope.hoverHero.title = "";
        }

        $("#Settings").sidebar('hide');
    });
})();
