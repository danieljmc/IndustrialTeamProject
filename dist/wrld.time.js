/*
 (c) 2014, Vladimir Agafonkin
 simpleheat, a tiny JavaScript library for drawing heatmaps with Canvas
 https://github.com/mourner/simpleheat
*/
!function(){"use strict";function t(i){return this instanceof t?(this._canvas=i="string"==typeof i?document.getElementById(i):i,this._ctx=i.getContext("2d"),this._width=i.width,this._height=i.height,this._max=1,void this.clear()):new t(i)}t.prototype={defaultRadius:25,defaultGradient:{.4:"blue",.6:"cyan",.7:"lime",.8:"yellow",1:"red"},data:function(t,i){return this._data=t,this},max:function(t){return this._max=t,this},add:function(t){return this._data.push(t),this},clear:function(){return this._data=[],this},radius:function(t,i){i=i||15;var a=this._circle=document.createElement("canvas"),s=a.getContext("2d"),e=this._r=t+i;return a.width=a.height=2*e,s.shadowOffsetX=s.shadowOffsetY=200,s.shadowBlur=i,s.shadowColor="black",s.beginPath(),s.arc(e-200,e-200,t,0,2*Math.PI,!0),s.closePath(),s.fill(),this},gradient:function(t){var i=document.createElement("canvas"),a=i.getContext("2d"),s=a.createLinearGradient(0,0,0,256);i.width=1,i.height=256;for(var e in t)s.addColorStop(e,t[e]);return a.fillStyle=s,a.fillRect(0,0,1,256),this._grad=a.getImageData(0,0,1,256).data,this},draw:function(t){this._circle||this.radius(this.defaultRadius),this._grad||this.gradient(this.defaultGradient);var i=this._ctx;i.clearRect(0,0,this._width,this._height);for(var a,s=0,e=this._data.length;e>s;s++)a=this._data[s],i.globalAlpha=Math.max(a[2]/this._max,t||.05),i.drawImage(this._circle,a[0]-this._r,a[1]-this._r);var n=i.getImageData(0,0,this._width,this._height);return this._colorize(n.data,this._grad),i.putImageData(n,0,0),this},_colorize:function(t,i){for(var a,s=3,e=t.length;e>s;s+=4)a=4*t[s],a&&(t[s-3]=i[a],t[s-2]=i[a+1],t[s-1]=i[a+2])}},window.simpleheat=t}(),

'use strict';
L.HeatLayer = (L.Layer ? L.Layer : L.Class).extend({

    options: {
        intensityFactor: 40
    },

    initialize: function (latlngs, options) {
        this._latlngs = latlngs;
        L.setOptions(this, options);
    },

    setLatLngs: function (latlngs) {
        this._latlngs = latlngs;
        return this.redraw();
    },

    addLatLng: function (latlng) {
        this._latlngs.push(latlng);
        return this.redraw();
    },

    setOptions: function (options) {
        L.setOptions(this, options);
        if (this._heat) {
            this._updateOptions();
        }
        return this.redraw();
    },

    redraw: function () {
        if (this._heat && !this._frame && this._map && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }

        if (this.options.pane) {
            this.getPane().appendChild(this._canvas);
        }else{
            map._panes.overlayPane.appendChild(this._canvas);
        }

        map.on('moveend', this._reset, this);

        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this._reset();
    },

    onRemove: function (map) {
        if (this.options.pane) {
            this.getPane().removeChild(this._canvas);
        }else{
            map.getPanes().overlayPane.removeChild(this._canvas);
        }

        map.off('moveend', this._reset, this);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    _initCanvas: function () {
        var canvas = this._canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer');

        var originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
        canvas.style[originProp] = '50% 50%';

        var size = this._map.getSize();
        canvas.width  = size.x;
        canvas.height = size.y;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));

        this._heat = simpleheat(canvas);
        this._updateOptions();
    },

    _updateOptions: function () {
        this._heat.radius(this.options.radius || this._heat.defaultRadius, this.options.blur);

        if (this.options.gradient) {
            this._heat.gradient(this.options.gradient);
        }
        if (this.options.max) {
            this._heat.max(this.options.max);
        }
    },

    _reset: function () {
        var topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);

        var size = this._map.getSize();

        if (this._heat._width !== size.x) {
            this._canvas.width = this._heat._width  = size.x;
        }
        if (this._heat._height !== size.y) {
            this._canvas.height = this._heat._height = size.y;
        }

        this._redraw();
    },

    _redraw: function () {
        if (!this._map) {
            return;
        }
        var data = [],
            r = this._heat._r,
            size = this._map.getSize(),
            bounds = new L.Bounds(
                L.point([-r, -r]),
                size.add([r, r])),

            max = this.options.max === undefined ? 1 : this.options.max,
            maxZoom = this.options.maxZoom === undefined ? this._map.getMaxZoom() : this.options.maxZoom,
            v = 1 / Math.pow(2, Math.max(0, Math.min(maxZoom - this._map.getZoom(), 12))),
            cellSize = r / 2,
            grid = [],
            panePos = this._map._getMapPanePos(),
            offsetX = panePos.x % cellSize,
            offsetY = panePos.y % cellSize,
            i, len, p, cell, x, y, j, len2, k;

        // console.time('process');
        for (i = 0, len = this._latlngs.length; i < len; i++) {
            if (this._latlngs[i].length > 3) {
                this._latlngs[i] = this._latlngs[i].slice(0, 3);
            }
            p = this._map.latLngToContainerPoint(this._latlngs[i]);
            if (bounds.contains(p)) {
                x = Math.floor((p.x - offsetX) / cellSize) + 2;
                y = Math.floor((p.y - offsetY) / cellSize) + 2;

                var intensity = this._latlngs[i][3] || 1;
                k = v * intensity * this.options.intensityFactor;

                grid[y] = grid[y] || [];
                cell = grid[y][x];

                if (!cell) {
                    grid[y][x] = [p.x, p.y, k];

                } else {
                    cell[0] = (cell[0] * cell[2] + p.x * k) / (cell[2] + k); // x
                    cell[1] = (cell[1] * cell[2] + p.y * k) / (cell[2] + k); // y
                    cell[2] += k; // cumulated intensity value
                }
            }
        }

        for (i = 0, len = grid.length; i < len; i++) {
            if (grid[i]) {
                for (j = 0, len2 = grid[i].length; j < len2; j++) {
                    cell = grid[i][j];
                    if (cell) {
                        data.push([
                            Math.round(cell[0]),
                            Math.round(cell[1]),
                            Math.min(cell[2], max)
                        ]);
                    }
                }
            }
        }
        // console.timeEnd('process');

        // console.time('draw ' + data.length);
        this._heat.data(data).draw(this.options.minOpacity);
        // console.timeEnd('draw ' + data.length);

        this._frame = null;
    },

    _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());

        if (L.DomUtil.setTransform) {
            L.DomUtil.setTransform(this._canvas, offset, scale);

        } else {
            this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
        }
    }
});

L.heatLayer = function (latlngs, options) {
    return new L.HeatLayer(latlngs, options);
};

/**
 * wrld.time.js - Time Series visualisation plugin
 */

/**
 * Calculates the number of days from a given other date
 * @param {Date} other the other date
 */
Date.prototype.daysFrom = function(other) {
    return Math.round(Math.abs((this.getTime() - other.getTime())/(24*60*60*1000)));
}

/**
 * Returns the date that is the number of days from this date
 * @param {Date} days the number of days to add
 */
Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

class WrldTime {

    constructor(map, data, options = {}) {
        this.options = {
            heatmap: options.heatmap || false,
            heatmapOptions: options.heatmapOptions || {},
            showIndoorPointsExternally: false,
            heatmapIntensity: options.heatmapIntensity || 50,
            indoorHeatmapIntensity: options.indoorHeatmapIntensity || 1,
            verticalPosition: options.verticalPosition || 'top',
            horizontalPosition: options.horizontalPosition || 'left',
            style: options.style
        }
        this._map = map;

        if (typeof(data) == 'string') {
            // Load data from URL
            var req = new XMLHttpRequest();
            var url = data;

            req.onreadystatechange = (e) => {
                if (req.readyState == 4 && req.status == 200) {
                    let res = JSON.parse(req.responseText);
                    console.log(res);
                    this.setData(res);
                    this.displaySlider();
                }
            };
            req.open("GET", url, true);
            req.send();
        } else {
            this.setData(data);
            this.displaySlider();
        }


        // Handle indoor map interactions
        this._map.indoors.on('indoormapenter', () => {
            var changed = false;
            if (this._layer != undefined) {
                this._layer.options.indoorMapId = this._map.indoors.getActiveIndoorMap().getIndoorMapId();
                this._layer.options.indoorMapFloorId = this._map.indoors.getFloor().getFloorIndex();
                changed = true;
            }
            if (this._heatmapLayer != undefined) {
                this._heatmapLayer.options.indoorMapId = this._map.indoors.getActiveIndoorMap().getIndoorMapId();
                this._heatmapLayer.options.indoorMapFloorId = this._map.indoors.getFloor().getFloorIndex();
                this._heatmapLayer.options.intensityFactor = this.options.indoorHeatmapIntensity;
                changed = true;
            }
            if (changed) this.setupTimeLayer();
        }); 
        this._map.indoors.on('indoormapexit', () => {
            var changed = false;
            if (this._layer != undefined) {
                this._layer.options.indoorMapId = undefined;
                this._layer.options.indoorMapFloorId = undefined;
                changed = true;
            }
            if (this._heatmapLayer != undefined) { 
                this._heatmapLayer.options.indoorMapId = undefined;
                this._heatmapLayer.options.indoorMapFloorId = undefined;
                this._heatmapLayer.options.intensityFactor = this.options.heatmapIntensity;
                changed = true;
            }
            if (changed) this.setupTimeLayer();
        });
        this._map.indoors.on('indoormapfloorchange', this.setupTimeLayer.bind(this));
    }

    /**
     * Sets the data for the time layer
     * @param {*} data the GeoJSON data
     */
    setData(data) {
        this.data = data;

        var _minDate, _maxDate;

        data.features.forEach(feature => {
            var date = new Date(feature.properties.date);

            if (_minDate == undefined) { _minDate = date; }
            if (_maxDate == undefined) { _maxDate = date; }
            
            if (date <= _minDate) _minDate = date;
            if (date >= _maxDate) _maxDate = date;
        });

        this._minDate = _minDate;

        this._steps = _minDate.daysFrom(_maxDate);

        this.setupTimeLayer();
    }

    /**
     * Display the slider
     */
    displaySlider() {
        if (this._container == undefined) {
            this._container = document.createElement('div');
            this._sliderContainer = document.createElement('div');
            this._slider = document.createElement('input');
            this._sliderTimestamp = document.createElement('span');
        }

        this._container.id = 'wrld-time-container';

        this._sliderTimestamp.id = 'wrld-time-timestamp';
        this._sliderTimestamp.innerHTML = this._minDate.toLocaleDateString("en-GB");
        
        this._slider.type = 'range';
        this._slider.classList.add('time-slider');
        this._slider.addEventListener('input', this.handleSliderChange.bind(this));
        this._slider.min = 0;
        this._slider.max = this._steps;
        this._slider.value = 0;

        this._sliderContainer.innerHTML = 'Date: ';
        this._sliderContainer.append(this._sliderTimestamp);
        this._sliderContainer.innerHTML += '<br/>'
        
        this._sliderContainer.append(this._slider);
        this._sliderContainer.classList.add('time-slider-container');

        this._container.append(this._sliderContainer);
        this._container.classList.add('time-container');
        switch (this.options.verticalPosition) {
            case 'top': this._container.style.alignItems = 'flex-start'; break;
            case 'bottom': this._container.style.alignItems = 'flex-end'; break;
        }
        switch (this.options.horizontalPosition) {
            case 'left': this._container.style.justifyContent = 'flex-start'; break;
            case 'center': this._container.style.justifyContent = 'center'; break;
            case 'right': this._container.style.justifyContent = 'flex-end'; break;
        }

        var wrldContainer = this._map._container.parentElement.parentElement;
        wrldContainer.style.position = 'relative';
        wrldContainer.append(this._container);
    }

    handleSliderChange() {
        var sliderTimestamp = document.getElementById('wrld-time-timestamp');
        if (sliderTimestamp != undefined) {
            var date = this._minDate.addDays(+this._slider.value);
            sliderTimestamp.innerHTML = date.toLocaleDateString("en-US");
        }
        this.setupTimeLayer();
    }

    /**
     * Setup the time layer
     */
    setupTimeLayer() {
        if (this._layer != undefined) {
            this._layer.remove();
        }

        if (this.data == undefined) return;

        this._layer = L.geoJSON(this.data, {
            pointToLayer: function(geoJsonPoint, latlng) {
                var props = geoJsonPoint.properties;
                var opts = {};

                if (props.elevation != undefined) opts.elevation = props.elevation;
                if (props.elevationMode != undefined) opts.elevationMode = props.elevationMode;
                if (props.indoorMapId != undefined) opts.indoorMapId = props.indoorMapId;
                if (props.indoorMapFloorId != undefined) opts.indoorMapFloorId = props.indoorMapFloorId;

                return L.marker(latlng, opts);
            },
            style: this.options.style,
            filter: this.shouldShowFeature.bind(this)
        });
        if (Object.keys(this._layer._layers).length != 0)
            this._layer.addTo(this._map);

        // Heatmapping
        if (this.options.heatmap) {
            let heatmapPoints = [];
            this.data.features.forEach(feature => {
                if (this.shouldShowFeature(feature, true)) {
                    var coords = Array.from(feature.geometry.coordinates);
                    var tmp = coords[0];
                    coords[0] = coords[1];
                    coords[1] = tmp;
                    if (coords.length < 3) {
                        if (this._map.indoors.isIndoors()) {
                            console.log(coords);
                            coords[2] = this._map.indoors.getFloorHeightAboveSeaLevel(this._map.indoors.getFloor().getFloorIndex()) - this._map.getAltitudeAtLatLng(L.latLng(coords));
                        } else {
                            coords[2] = 1;
                        }
                    }
                    if (feature.properties.intensity) coords[3] = feature.properties.intensity;
                    if (feature.type = 'Point' && coords[0].length == undefined) {
                        heatmapPoints.push(coords);
                    }
                }
            });
            if (heatmapPoints.length > 0) {
                if (this._heatmapLayer != undefined) {
                    this._heatmapLayer.setLatLngs(heatmapPoints);
                } else {
                    this._heatmapLayer = L.heatLayer(heatmapPoints, this.options.heatmapOptions).addTo(this._map);
                }
            }
        }
    }

    /**
     * Returns true if the given feature should be displayed
     * @param {GeoJSON} feature the feature to test
     */
    shouldShowFeature(feature, heatmap = false) {
        // Heatmaps are handled outside of the GeoJSON layer
        var isIndoors = this._map.indoors.isIndoors();
        var featureIsIndoors = feature.properties.indoorMapId != undefined;

        if (!heatmap && this.options.heatmap && feature.geometry.type == 'Point') return false;

        if (isIndoors) {
            var floor = this._map.indoors.getFloor().getFloorIndex();
            if (!featureIsIndoors) return false;
            if (feature.properties.indoorMapFloorId != floor) return false;
        } else {
            if (!this.options.showIndoorPointsExternally && featureIsIndoors) return false;
        }

        return (new Date(feature.properties.date)) <= this._minDate.addDays((this._slider) ? this._slider.value : 0);
    }

}

function wrldTime(map, data, options) {
    return new WrldTime(map, data, options);
}