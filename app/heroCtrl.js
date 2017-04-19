(function(){
    
    'use strict';

    var heroLoader = new qtek.loader.GLTF();

    var app = angular.module("heroViewer");

    // Create camera
    var camera = new qtek.camera.Perspective({
        aspect : window.innerWidth / window.innerHeight,
        far : 1000
    });
    camera.position.set(40, 10, 40);
    camera.lookAt(new qtek.math.Vector3(0, 8, 0));
    
    // Mouse control
    var control = new qtek.plugin.OrbitControl({
        target : camera,
        domElement : document.getElementById("ViewPort"),
        sensitivity : 0.4,
        minDistance : 35,
        maxDistance : 70,
        minPolarAngle : Math.PI / 4,
        maxPolarAngle : Math.PI / 2
    });

    var shadowMapPass = new qtek.prePass.ShadowMap({
        softShadow: qtek.prePass.ShadowMap.VSM,
        shadowBlur: 0.2
    });

    // Create scene
    var scene = new qtek.Scene();
    var light = new qtek.light.Directional({
        intensity : 0.7,
        shadowResolution : 512,
        shadowBias : 0.02
    });
    light.position.set(10, 20, 5);
    light.lookAt(new qtek.math.Vector3(0, 10, 0));

    scene.add(light);
    scene.add(new qtek.light.Ambient({
        intensity : 0.2
    }));

    var rockLoader = new qtek.loader.GLTF();
    var heroFragShader;
    var rockNode;
    var heroRootNode;
    rockLoader.once('success', function(res) {
        rockNode = res.scene.getNode('badside_rocks006_model');
        rockNode.rotation.rotateX(-Math.PI/2);
        rockNode.position.set(-5, -3.2, 0);
        rockNode.scale.set(0.15, 0.15, 0.15);
        var mat = rockNode.material;
        var shader = mat.shader;
        shader.setFragment(heroFragShader);
        // reattach
        mat.attachShader(shader);
        shader.enableTexture('maskMap2');
        shader.enableTexture('diffuseMap');
        shader.define('vertex', 'IS_SPECULAR_MAP');
        var specularTexture = new qtek.Texture2D();
        var diffuseTexture = new qtek.Texture2D();
        specularTexture.load('assets/rock/textures/badside_rocks001_spec.png');
        diffuseTexture.load('assets/rock/textures/badside_rocks001.png');
        mat.set('maskMap2', specularTexture);
        mat.set('diffuseMap', diffuseTexture);

        rockNode.visible = false;
        scene.add(rockNode);
    });

    app.controller('hero', function(
        $scope, $http, $routeParams,
        renderer, getResourcePath, cache, animation, background, config
    ) {
        var heroName = $routeParams.name;
        var heroTitle;
        if (!cache.has('overview')) {
            $http.get(getResourcePath('heroes/overview_en.json'))
                .success(function(data) {
                    cache.set('overview', data);
                    $scope.heroList = data;
                    $scope.heroList.forEach(function(item) {
                        if (item.name === heroName) {
                            $scope.overview = item;
                        }
                    });
                });
        } else {
            $scope.heroList = cache.get('overview');
            $scope.heroList.forEach(function(item) {
                if (item.name === heroName) {
                    $scope.overview = item;
                }
            });
        }
        $scope.showAbout = function() {
            $("#About").toggleClass('show');
        }
        $scope.toggleSettings = function() {
            $("#Settings").sidebar('toggle');
        }
        $scope.resetView = function() {
            camera.position.set(40, 10, 40);
            camera.lookAt(new qtek.math.Vector3(0, 8, 0), new qtek.math.Vector3(0, 1, 0));
        }
        $scope.config = config;

        $scope.$watch('config.shadow', function(obj) {
            shadowMapPass.dispose(renderer);
            shadowMapPass.softShadow = obj.softShadow == 'vsm' ? qtek.prePass.ShadowMap.VSM : qtek.prePass.ShadowMap.PCF;
            light.shadowResolution = obj.resolution;
        }, true);

        if (rockNode) {
            rockNode.visible = true;
        } else {
            rockLoader.once('success', function() {
                rockNode.visible = true;
            });
        }

        var heroRootPath = "heroes/" + heroName + "/";
        var materials = {};

        if (heroRootNode) {
            renderer.disposeNode(heroRootNode);
        }
        heroRootNode = new qtek.Node();
        heroRootNode.rotation.rotateX(-Math.PI/2);
        heroRootNode.scale.set(0.1, 0.1, 0.1);
        $http.get(getResourcePath(heroRootPath + 'materials.json'))
        .then(function(result) {
            materials = result.data;
            return $http.get('assets/shaders/hero.essl');
        })
        .then(function(result) {
            heroFragShader = result.data;
            if (!rockNode) {
                rockLoader.load('assets/rock/rock.json');
            }
            return $http.get(getResourcePath(heroRootPath + heroName + ".json"));
        })
        .then(function(result) {
            var data = result.data;
            // replace path
            for (var name in data.buffers) {
                data.buffers[name].path = getResourcePath(
                    heroRootPath + data.buffers[name].path
                );
            }
            for (var name in data.images) {
                data.images[name].path = getResourcePath(
                    heroRootPath + data.images[name].path
                );
            }

            heroLoader.parse(data);
            heroLoader.success(function(res) {
                var children = res.scene.children();
                var animationPrepared = false;
                for (var i = 0; i < children.length; i++) {
                    heroRootNode.add(children[i]);
                }
                heroRootNode.update(true);
                var meshes = [];
                heroRootNode.traverse(function(node) {
                    if (node.geometry) {
                        if (node.geometry.getVertexNumber() > 0) {
                            meshes.push(node);
                            node.geometry.generateTangents();
                        }
                        if (node.material && heroFragShader) {
                            var mat = node.material;
                            var shader = mat.shader;
                            shader.setFragment(heroFragShader);
                            // reattach
                            mat.attachShader(shader);
                            shader.enableTexturesAll();
                        }
                    }
                });
                for (var name in materials) {
                    var params = materials[name];
                    var mat = res.materials[name];
                    var Texture2D = qtek.Texture2D;
                    mat.shader.disableTexturesAll();
                    if (mat) {
                        ['diffuseMap', 'normalMap', 'maskMap1', 'maskMap2']
                            .forEach(function(name) {
                                if (params[name] !== undefined) {
                                    var texture = new Texture2D({
                                        wrapS : qtek.Texture.REPEAT,
                                        wrapT : qtek.Texture.REPEAT
                                    });
                                    texture.load(getResourcePath(params[name]));
                                    mat.set(name, texture);
                                    mat.shader.enableTexture(name);
                                }
                            });
                        ['u_SpecularExponent', 'u_SpecularScale', 'u_SpecularColor', 'u_RimLightScale', 'u_RimLightColor']
                            .forEach(function(name) {
                                if (params[name] !== undefined) {
                                    mat.set(name, params[name]);
                                }
                            });
                        if (params.transparent) {
                            mat.transparent = true;
                            mat.depthMask = false;
                        }
                    }
                }
                for (var i = 0; i < meshes.length; i++) {
                    var mesh = meshes[i];
                    qtek.util.mesh.splitByJoints(mesh, 30, true);
                }

                scene.add(heroRootNode);

                animation.off('frame');
                animation.on('frame', function(deltaTime) {
                    control.update(deltaTime);
                    if (animationPrepared) {
                        for (var name in res.skeletons) {
                            res.skeletons[name].setPose(0);
                        }
                    }
                    var start = new Date().getTime();
                    if (config.shadow.enabled) {
                        shadowMapPass.render(renderer, scene, camera);
                    }
                    background.render(renderer);
                    camera.aspect = renderer.canvas.width / renderer.canvas.height;

                    $scope.log = renderer.render(scene, camera);
                    var end = new Date().getTime();
                    $scope.log.frameTime = (end-start).toFixed(1) + 'ms';
                    $scope.log.fps = parseInt(1000 / deltaTime);
                });

                setInterval(function() {
                    $scope.$digest();
                }, 500);


                // Loading animations
                $http.get(getResourcePath(heroRootPath + 'animations.json'))
                    .success(function(animations) {
                        var defaultAnim = animations['default'] || animations['idle'][0];
                        $http.get(getResourcePath(defaultAnim.path))
                            .success(function(data) {
                                var frames = SMDParser(data);
                                var skinningClip = new qtek.animation.SkinningClip();
                                skinningClip.setLoop(true);

                                for (var name in frames) {
                                    var jointClip = new qtek.animation.TransformClip({
                                        name: name,
                                        keyFrames: frames[name]
                                    });
                                    skinningClip.addJointClip(jointClip);
                                }
                                animation.removeClipsAll();
                                animation.addClip(skinningClip);
                                for (var name in res.skeletons) {
                                    res.skeletons[name].addClip(skinningClip);
                                }
                                animationPrepared = true;
                            });
                    });
                // http://stackoverflow.com/questions/17039998/angular-not-making-http-requests-immediately
                // http://www.benlesh.com/2013/08/angularjs-watch-digest-and-apply-oh-my.html
                $scope.$digest();

                //InfoVis
            var heroStats;
            $.ajax({
                url: 'https://api.opendota.com/api/heroStats',
                async: false,
                dataType: 'json',
                success: function(response) {
                    heroStats = response;
                }
            });

            $('#heroGraph').show();

            var thisHeroStats = _.find(heroStats, {'localized_name': $scope.overview.title});
            console.log(thisHeroStats);

            var heroBenchmarks;
            $.ajax({
              url: "https://api.opendota.com/api/benchmarks",
              type: "get", //send it through get method
              data: { 
                hero_id: thisHeroStats.id
              },
              async: false,
              success: function(response) {
                console.log(response);
                heroBenchmarks = response;
              },
              error: function(xhr) {
                //Do Something to handle error
              }
            });

            var data = heroBenchmarks.result.gold_per_min;
            var svg = d3.select("#heroGraph"),
            margin = {top: 20, right: 20, bottom: 30, left: 50},
            width = +svg.attr("width") - margin.left - margin.right,
            height = +svg.attr("height") - margin.top - margin.bottom,
            
            g = svg.append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            var x = d3.scaleLinear().range([0, width]);
            var y = d3.scaleLinear().range([height, 0]);

            var line = d3.line()
                .x(function(d) { return x(d.percentile); })
                .y(function(d) { return y(d.value); });

            x.domain(d3.extent(data, function(d) { return d.percentile; }));
            y.domain(d3.extent(data, function(d) { return d.value; }));

            g.append("g")
                .attr("transform", "translate(0," + height + ")")
                .call(d3.axisBottom(x))
                .append('text')
                .attr("fill", "#000")
                .attr("dy", "0.71em")
                .attr('x', width)
                .attr('y', -10)
                .attr("text-anchor", "end")
                .text('Percentile')

            g.append("g")
                .call(d3.axisLeft(y))
                .append("text")
                .attr("fill", "#000")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", "0.71em")
                .attr("text-anchor", "end")
                .text("GPM");

            g.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", "steelblue")
                .attr("stroke-linejoin", "round")
                .attr("stroke-linecap", "round")
                .attr("stroke-width", 1.5)
                .attr("d", line);
            });
         });
    });
})();