
var Viewer = {
    panZoom: null,
    Params: [],
    ViewModel: null,
    ViewScale: null,
    scaleDelta: 10,
    Constructor: function () { },
    Refresh: function (index, arg) {

        //apply slider parameters
        if (typeof index !== 'undefined') {
            Viewer.Params[index] = arg;
        }

        var model = makerjs.kit.construct(Viewer.Constructor, Viewer.Params);

        Viewer.ViewModel = model;

        //measure the model to make it fit in the window
        var measureSize = Viewer.Fit();

        //svg output
        var renderOptions = {
            viewBox: false,
            stroke: null,
            strokeWidth: null,
            annotate: false,
            scale: Viewer.ViewScale * .8,
            useSvgPathOnly: false,
            svgAttrs: { id: 'svg1' }
        };

        //show crosshairs
        var crossHairSize = 150 / Viewer.ViewScale;

        var svgModel = {
            paths: {
                'crosshairs-vertical': new makerjs.paths.Line([0, crossHairSize], [0, -crossHairSize]),
                'crosshairs-horizontal': new makerjs.paths.Line([-crossHairSize, 0], [crossHairSize, 0])
            },
            models: {
                viewModel: model
            }
        };

        var svg = makerjs.exporter.toSVG(svgModel, renderOptions);
        document.getElementById("svg-render").innerHTML = svg;

        var zoom = null;
        var center = true;
        var pan = null;
        if (Viewer.panZoom) {
            zoom = Viewer.panZoom.getZoom();
            pan = Viewer.panZoom.getPan();
            center = false;
        }

        Viewer.panZoom = svgPanZoom('#svg1', {
            zoomEnabled: true,
            controlIconsEnabled: true,
            fit: false,
            center: center,
            customEventsHandler: Viewer.touchEventsHandler
        });

        if (zoom && pan) {
            Viewer.panZoom.zoom(zoom);
            Viewer.panZoom.pan(pan);
        }

    },

    Fit: function () {
        var deltaFactor = 10;
        var padding = 100;

        //measure the model
        var size = makerjs.measure.modelExtents(Viewer.ViewModel);
        var width = size.high[0] - size.low[0];
        var height = size.high[1] - size.low[1];

        //measure the view
        var svgRender = document.getElementById("svg-render");

        //find the best scale to fit

        Viewer.ViewScale = Math.min((svgRender.clientWidth - padding) / width, (svgRender.clientHeight - padding) / height);
        Viewer.scaleDelta = Viewer.ViewScale / deltaFactor;

        return size;
    },

    getRaw: function (type) {
        switch (type) {
            case "dxf":
                return makerjs.exporter.toDXF(Viewer.ViewModel);

            case "svg":
                return makerjs.exporter.toSVG(Viewer.ViewModel);

            case "json":
                return JSON.stringify(Viewer.ViewModel);

            case "openjscad":
                return makerjs.exporter.toOpenJsCad(Viewer.ViewModel);

            case "stl":
                return makerjs.exporter.toSTL(Viewer.ViewModel);
        }
    },

    getExport: function (type) {
        var raw = Viewer.getRaw(type);
        var encoded = encodeURIComponent(raw);
        switch (type) {
            case "dxf":
                return "data:application/dxf," + encoded;

            case "svg":
                return "data:image/svg+xml," + encoded;

            case "json":
                return "data:application/json," + encoded;

            case "openjscad":
                return "data:text/javascript," + encoded;

            case "stl":
                return "data:application/stl," + encoded;
        }
    },

    prepareView: function () {

        //attach mousewheel
        //var view = document.getElementById("view");

        /*
        view.onwheel = view.onmousewheel = function (ev) {
            if (Viewer.ViewScale) {
                Viewer.ViewScale = Math.max(Viewer.ViewScale + ((ev.wheelDelta || ev.deltaY) > 0 ? 1 : -1) * Viewer.scaleDelta, 1);
                Viewer.Refresh();
            }
            return false;
        };
        */

        Viewer.loadModelCode(document.location.search.substring(6));   // following "?demo="
    },

    populateParams: function (filename) {
        Viewer.Params = [];

        var paramsHtml = '';

        if (Viewer.Constructor.metaParameters) {
            for (var i = 0; i < Viewer.Constructor.metaParameters.length; i++) {
                var attrs = makerjs.cloneObject( Viewer.Constructor.metaParameters[i]);

                var id = 'input_' + i;
                var label = new makerjs.exporter.XmlTag('label', { "for": id, title: attrs.title });
                label.innerText = attrs.title + ': ';

                var input = null;

                switch (attrs.type) {

                    case 'range':
                        attrs.title = attrs.value;
                        input = new makerjs.exporter.XmlTag('input', attrs);
                        input.attrs['onchange'] = 'this.title=this.value;Viewer.Refresh(' + i + ', makerjs.round(this.valueAsNumber, .001))';
                        input.attrs['id'] = id;

                        Viewer.Params.push(attrs.value);

                        break;

                    case 'bool':

                        var checkboxAttrs = {
                            id: id,
                            type: 'checkbox',
                            onchange: 'Viewer.Refresh(' + i + ', this.checked)'
                        };

                        if (attrs.value) {
                            checkboxAttrs['checked'] = true;
                        }

                        input = new makerjs.exporter.XmlTag('input', checkboxAttrs);

                        Viewer.Params.push(attrs.value);

                        break;

                    case 'select':

                        var selectAttrs = {
                            id: id,
                            onchange: 'Viewer.Refresh(' + i + ', JSON.parse(this.options[this.selectedIndex].innerText))'
                        };

                        input = new makerjs.exporter.XmlTag('select', selectAttrs);
                        var options = '';

                        for (var j = 0; j < attrs.value.length; j++) {
                            var option = new makerjs.exporter.XmlTag('option');
                            option.innerText = JSON.stringify(attrs.value[j]);

                            options += option.toString();
                        }

                        input.innerText = options;
                        input.innerTextEscaped = true;

                        Viewer.Params.push(attrs.value[0]);

                        break;
                }

                if (!input) continue;

                var div = new makerjs.exporter.XmlTag('div');
                div.innerText = label.toString() + input.toString();
                div.innerTextEscaped = true;
                paramsHtml += div.toString();
            }
        }
        document.getElementById("params").innerHTML = paramsHtml;
    },

    loadModelCode: function (filename) {

        if (filename) {

            var _makerjs = makerjs;

            function newModelCode() {
                Viewer.ViewScale = null;

                makerjs = _makerjs;

                if (!Viewer.Constructor) {
                    Viewer.Constructor = require(filename);
                }

                Viewer.populateParams(filename);

                if (Viewer.panZoom) {
                    Viewer.panZoom = null;
                }

                Viewer.Refresh();
            }

            if (filename in makerjs.models) {

                Viewer.ViewScale = null;

                Viewer.Constructor = makerjs.models[filename];

                Viewer.populateParams(filename);

                if (Viewer.panZoom) {
                    Viewer.panZoom = null;
                }

                Viewer.Refresh();

                return;
            }

            var script = document.createElement('script');
            script.setAttribute('src', '/maker.js/demos/' + filename + '.js');
            
            script.onload = function () {
                setTimeout(newModelCode, 0);
            };

            window.require = function (name) {
                if (name == 'makerjs' || name == '../target/js/node.maker.js') {
                    return _makerjs;
                }
                return module.exports;
            };
            Viewer.Constructor = null;

            document.getElementsByTagName('head')[0].appendChild(script);
        }

    },

    touchEventsHandler: {
        haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel'],
        init: function (options) {
            var instance = options.instance
              , initialScale = 1
              , pannedX = 0
              , pannedY = 0

            // Init Hammer
            // Listen only for pointer and touch events
            this.hammer = Hammer(options.svgElement, {
                inputClass: Hammer.SUPPORT_POINTER_EVENTS ? Hammer.PointerEventInput : Hammer.TouchInput
            })

            // Enable pinch
            this.hammer.get('pinch').set({ enable: true })

            // Handle double tap
            this.hammer.on('doubletap', function (ev) {
                instance.zoomIn()
            })

            // Handle pan
            this.hammer.on('panstart panmove', function (ev) {
                // On pan start reset panned variables
                if (ev.type === 'panstart') {
                    pannedX = 0
                    pannedY = 0
                }

                // Pan only the difference
                instance.panBy({ x: ev.deltaX - pannedX, y: ev.deltaY - pannedY })
                pannedX = ev.deltaX
                pannedY = ev.deltaY
            })

            // Handle pinch
            this.hammer.on('pinchstart pinchmove', function (ev) {
                // On pinch start remember initial zoom
                if (ev.type === 'pinchstart') {
                    initialScale = instance.getZoom()
                    instance.zoom(initialScale * ev.scale)
                }

                instance.zoom(initialScale * ev.scale)

            })

            // Prevent moving the page on some devices when panning over SVG
            options.svgElement.addEventListener('touchmove', function (e) { e.preventDefault(); });
        },
        destroy: function () {
            this.hammer.destroy()
        }
    }
};

window.onload = Viewer.prepareView;
