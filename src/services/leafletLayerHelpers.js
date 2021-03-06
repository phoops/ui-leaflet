angular.module('ui-leaflet')
.factory('leafletLayerHelpers', function ($rootScope, $q, leafletLogger, leafletHelpers, leafletIterators) {
    var Helpers = leafletHelpers;
    var isString = leafletHelpers.isString;
    var isObject = leafletHelpers.isObject;
    var isArray = leafletHelpers.isArray;
    var isDefined = leafletHelpers.isDefined;
    var errorHeader = leafletHelpers.errorHeader;
    var $it = leafletIterators;
    var $log = leafletLogger;

    var utfGridCreateLayer = function(params) {
        if (!Helpers.UTFGridPlugin.isLoaded()) {
            $log.error('[AngularJS - Leaflet] The UTFGrid plugin is not loaded.');
            return;
        }
        var utfgrid = new L.UtfGrid(params.url, params.pluginOptions);

        var toSend = {
            model: params.$parent
        };

        // TODO Use event manager
        utfgrid.on('mouseover', function(e) {
            angular.extend(toSend, {
                leafletEvent: e,
                leafletObject: e.target,
            });
            $rootScope.$broadcast('leafletDirectiveMap.utfgridMouseover', toSend);
        });

        utfgrid.on('mouseout', function(e) {
            angular.extend(toSend, {
                leafletEvent: e,
                leafletObject: e.target,
            });
            $rootScope.$broadcast('leafletDirectiveMap.utfgridMouseout', toSend);
        });

        utfgrid.on('click', function(e) {
            angular.extend(toSend, {
                leafletEvent: e,
                leafletObject: e.target,
            });
            $rootScope.$broadcast('leafletDirectiveMap.utfgridClick', toSend);
        });

        utfgrid.on('mousemove', function(e) {
            angular.extend(toSend, {
                leafletEvent: e,
                leafletObject: e.target,
            });
            $rootScope.$broadcast('leafletDirectiveMap.utfgridMousemove', toSend);
        });

        return utfgrid;
    };

    var layerTypes = {
        xyz: {
            mustHaveUrl: true,
            createLayer: function(params) {
                return L.tileLayer(params.url, params.options);
            }
        },
        mapbox: {
            mustHaveKey: true,
            createLayer: function(params) {
                var version = 3;
                if(isDefined(params.options.version) && params.options.version === 4) {
                    version = params.options.version;
                }
                var url = version === 3?
                    '//{s}.tiles.mapbox.com/v3/' + params.key + '/{z}/{x}/{y}.png':
                    '//api.tiles.mapbox.com/v4/' + params.key + '/{z}/{x}/{y}.png?access_token=' + params.apiKey;
                return L.tileLayer(url, params.options);
            }
        },
        geoJSON: {
            mustHaveUrl: true,
            createLayer: function(params) {
                if (!Helpers.GeoJSONPlugin.isLoaded()) {
                    return;
                }
                return new L.TileLayer.GeoJSON(params.url, params.pluginOptions, params.options);
            }
        },
        geoJSONShape: {
            mustHaveUrl: false,
            createLayer: function(params) {
                        return new L.GeoJSON(params.data,
                            params.options);
            }
        },
        geoJSONAwesomeMarker: {
            mustHaveUrl: false,
            createLayer: function(params) {
                    return new L.geoJson(params.data, {
                        pointToLayer: function (feature, latlng) {
                            return L.marker(latlng, {icon: L.AwesomeMarkers.icon(params.icon)});
                    }
                });
            }
        },
        geoJSONVectorMarker: {
            mustHaveUrl: false,
            createLayer: function(params) {
                    return new L.geoJson(params.data, {
                        pointToLayer: function (feature, latlng) {
                            return L.marker(latlng, {icon: L.VectorMarkers.icon(params.icon)});
                    }
                });
            }
        },
        cartodbTiles: {
            mustHaveKey: true,
            createLayer: function(params) {
                var url = isDefined(params.url)?
                    params.url+'/'+params.user:
                    '//' + params.user + '.cartodb.com';
                url += '/api/v1/map/' + params.key + '/{z}/{x}/{y}.png';
                return L.tileLayer(url, params.options);
            }
        },
        cartodbUTFGrid: {
            mustHaveKey: true,
            mustHaveLayer : true,
            createLayer: function(params) {
                var url = isDefined(params.url)?
                    params.url+'/'+params.user:
                    '//' + params.user + '.cartodb.com';
                params.url = url + '/api/v1/map/' + params.key + '/' + params.layer + '/{z}/{x}/{y}.grid.json';
                return utfGridCreateLayer(params);
            }
        },
        cartodbInteractive: {
            mustHaveKey: true,
            mustHaveLayer : true,
            createLayer: function(params) {
                var url = isDefined(params.url)?
                    params.url+'/'+params.user:
                    '//' + params.user + '.cartodb.com';
                var tilesURL = url + '/api/v1/map/' + params.key + '/{z}/{x}/{y}.png';
                var tileLayer = L.tileLayer(tilesURL, params.options);
                var layers = [tileLayer];

                var addUtfLayer = function(parent, params, layer) {
                    var paramsCopy = angular.copy(params);
                    paramsCopy.url = url + '/api/v1/map/' + paramsCopy.key + '/' + layer + '/{z}/{x}/{y}.grid.json';
                    parent.push(utfGridCreateLayer(paramsCopy));
                };

                if(isArray(params.layer)) {
                    for(var i = 0; i < params.layer.length; i++) {
                        addUtfLayer(layers, params, params.layer[i]);
                    }
                } else {
                    addUtfLayer(layers, params, params.layer);
                }
                return L.layerGroup(layers);
            }
        },
        wms: {
            mustHaveUrl: true,
            createLayer: function(params) {
                return L.tileLayer.wms(params.url, params.options);
            }
        },
        wmts: {
            mustHaveUrl: true,
            createLayer: function(params) {
                return L.tileLayer.wmts(params.url, params.options);
            }
        },
        group: {
            mustHaveUrl: false,
            createLayer: function (params) {
                var lyrs = [];
                $it.each(params.options.layers, function(l){
                  lyrs.push(createLayer(l));
                });
                params.options.loadedDefer = function() {
                    var defers = [];
                    if(isDefined(params.options.layers)) {
                        for (var i = 0; i < params.options.layers.length; i++) {
                            var d = params.options.layers[i].layerOptions.loadedDefer;
                            if(isDefined(d)) {
                                defers.push(d);
                            }
                        }
                    }
                    return defers;
                };
                return L.layerGroup(lyrs);
            }
        },
        featureGroup: {
            mustHaveUrl: false,
            createLayer: function () {
                return L.featureGroup();
            }
        },
        here: {
            mustHaveUrl: false,
            createLayer: function(params) {
                var provider = params.provider || 'HERE.terrainDay';
                if (!Helpers.LeafletProviderPlugin.isLoaded()) {
                    return;
                }
                return new L.TileLayer.Provider(provider, params.options);
            }
        },
        agsBase: {
            mustHaveLayer : true,
            createLayer: function (params) {
                if (!Helpers.AGSBaseLayerPlugin.isLoaded()) {
                    return;
                }
                return L.esri.basemapLayer(params.layer, params.options);
            }
        },
        ags: {
            mustHaveUrl: true,
            createLayer: function(params) {
                if (!Helpers.AGSLayerPlugin.isLoaded()) {
                    return;
                }

                var options = angular.copy(params.options);
                angular.extend(options, {
                    url: params.url
                });
                var layer = new lvector.AGS(options);
                layer.onAdd = function(map) {
                    this.setMap(map);
                };
                layer.onRemove = function() {
                    this.setMap(null);
                };
                return layer;
            }
        },
        agsFeature: {
            mustHaveUrl: true,
            createLayer: function(params) {
                if (!Helpers.AGSFeatureLayerPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The esri plugin is not loaded.');
                    return;
                }

                params.options.url = params.url;

                var layer = L.esri.featureLayer(params.options);
                var load = function() {
                    if(isDefined(params.options.loadedDefer)) {
                        params.options.loadedDefer.resolve();
                    }
                };
                layer.on('loading', function() {
                    params.options.loadedDefer = $q.defer();
                    layer.off('load', load);
                    layer.on('load', load);
                });

                return layer;
            }
        },
        agsTiled: {
            mustHaveUrl: true,
            createLayer: function(params) {
                if (!Helpers.AGSTiledMapLayerPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The esri plugin is not loaded.');
                    return;
                }

                params.options.url = params.url;

                return L.esri.tiledMapLayer(params.options);
            }
        },
        agsDynamic: {
            mustHaveUrl: true,
            createLayer: function(params) {
                if (!Helpers.AGSDynamicMapLayerPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The esri plugin is not loaded.');
                    return;
                }

                params.options.url = params.url;

                return L.esri.dynamicMapLayer(params.options);
            }
        },
        agsImage: {
            mustHaveUrl: true,
            createLayer: function(params) {
                if (!Helpers.AGSImageMapLayerPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The esri plugin is not loaded.');
                    return;
                }
                 params.options.url = params.url;

                return L.esri.imageMapLayer(params.options);
            }
        },
        agsClustered: {
            mustHaveUrl: true,
            createLayer: function(params) {
                if (!Helpers.AGSClusteredLayerPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The esri clustered layer plugin is not loaded.');
                    return;
                }

                if(!Helpers.MarkerClusterPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The markercluster plugin is not loaded.');
                    return;
                }
                return L.esri.clusteredFeatureLayer(params.url, params.options);
            }
        },
        agsHeatmap: {
            mustHaveUrl: true,
            createLayer: function(params) {
                if (!Helpers.AGSHeatmapLayerPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The esri heatmap layer plugin is not loaded.');
                    return;
                }

                if(!Helpers.HeatLayerPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The heatlayer plugin is not loaded.');
                    return;
                }
                return L.esri.heatmapFeatureLayer(params.url, params.options);
            }
        },
        markercluster: {
            mustHaveUrl: false,
            createLayer: function(params) {
                if (!Helpers.MarkerClusterPlugin.isLoaded()) {
                    $log.warn(errorHeader + ' The markercluster plugin is not loaded.');
                    return;
                }
                return new L.MarkerClusterGroup(params.options);
            }
        },
        imageOverlay: {
            mustHaveUrl: true,
            mustHaveBounds : true,
            createLayer: function(params) {
                return L.imageOverlay(params.url, params.bounds, params.options);
            }
        },
        iip: {
            mustHaveUrl: true,
            createLayer: function(params) {
                return L.tileLayer.iip(params.url, params.options);
            }
        },

        // This "custom" type is used to accept every layer that user want to define himself.
        // We can wrap these custom layers like heatmap or yandex, but it means a lot of work/code to wrap the world,
        // so we let user to define their own layer outside the directive,
        // and pass it on "createLayer" result for next processes
        custom: {
            createLayer: function (params) {
                if (params.layer instanceof L.Class) {
                    return angular.copy(params.layer);
                }
                else {
                    $log.error('[AngularJS - Leaflet] A custom layer must be a leaflet Class');
                }
            }
        },
        cartodb: {
            mustHaveUrl: true,
            createLayer: function(params) {
                return cartodb.createLayer(params.map, params.url);
            }
        }
    };

    function isValidLayerType(layerDefinition) {
        // Check if the baselayer has a valid type
        if (!isString(layerDefinition.type)) {
            $log.error('[AngularJS - Leaflet] A layer must have a valid type defined.');
            return false;
        }

        if (Object.keys(layerTypes).indexOf(layerDefinition.type) === -1) {
            $log.error('[AngularJS - Leaflet] A layer must have a valid type: ' + Object.keys(layerTypes));
            return false;
        }

        // Check if the layer must have an URL
        if (layerTypes[layerDefinition.type].mustHaveUrl && !isString(layerDefinition.url)) {
            $log.error('[AngularJS - Leaflet] A base layer must have an url');
            return false;
        }

        if (layerTypes[layerDefinition.type].mustHaveData && !isDefined(layerDefinition.data)) {
            $log.error('[AngularJS - Leaflet] The base layer must have a "data" array attribute');
            return false;
        }

        if(layerTypes[layerDefinition.type].mustHaveLayer && !isDefined(layerDefinition.layer)) {
            $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have an layer defined');
            return false;
        }

        if (layerTypes[layerDefinition.type].mustHaveBounds && !isDefined(layerDefinition.bounds)) {
            $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have bounds defined');
            return false ;
        }

        if (layerTypes[layerDefinition.type].mustHaveKey && !isDefined(layerDefinition.key)) {
            $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have key defined');
            return false ;
        }
        return true;
    }

    function createLayer(layerDefinition) {
        if (!isValidLayerType(layerDefinition)) {
            return;
        }

        if (!isString(layerDefinition.name)) {
            $log.error('[AngularJS - Leaflet] A base layer must have a name');
            return;
        }
        if (!isObject(layerDefinition.layerParams)) {
            layerDefinition.layerParams = {};
        }
        if (!isObject(layerDefinition.layerOptions)) {
            layerDefinition.layerOptions = {};
        }

        // Mix the layer specific parameters with the general Leaflet options. Although this is an overhead
        // the definition of a base layers is more 'clean' if the two types of parameters are differentiated
        for (var attrname in layerDefinition.layerParams) {
            layerDefinition.layerOptions[attrname] = layerDefinition.layerParams[attrname];
        }

        var params = {
            url: layerDefinition.url,
            data: layerDefinition.data,
            options: layerDefinition.layerOptions,
            layer: layerDefinition.layer,
            icon: layerDefinition.icon,
            type: layerDefinition.layerType,
            bounds: layerDefinition.bounds,
            key: layerDefinition.key,
            apiKey: layerDefinition.apiKey,
            pluginOptions: layerDefinition.pluginOptions,
            user: layerDefinition.user,
            $parent: layerDefinition
        };

        //TODO Add $watch to the layer properties
        return layerTypes[layerDefinition.type].createLayer(params);
    }

    function safeAddLayer(map, layer) {
        if (layer && typeof layer.addTo === 'function') {
            layer.addTo(map);
        } else {
            map.addLayer(layer);
        }
    }

    function safeRemoveLayer(map, layer, layerOptions) {
        if(isDefined(layerOptions) && isDefined(layerOptions.loadedDefer)) {
            if(angular.isFunction(layerOptions.loadedDefer)) {
                var defers = layerOptions.loadedDefer();
                $log.debug('Loaded Deferred', defers);
                var count = defers.length;
                if(count > 0) {
                    var resolve = function() {
                        count--;
                        if(count === 0) {
                            map.removeLayer(layer);
                        }
                    };

                    for(var i = 0; i < defers.length; i++) {
                        defers[i].promise.then(resolve);
                    }
                } else {
                    map.removeLayer(layer);
                }
            } else {
                layerOptions.loadedDefer.promise.then(function() {
                    map.removeLayer(layer);
                });
            }
        } else {
            map.removeLayer(layer);
        }
    }

    return {
        createLayer: createLayer,
        layerTypes: layerTypes,
        safeAddLayer: safeAddLayer,
        safeRemoveLayer: safeRemoveLayer
    };
});
