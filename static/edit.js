(function(L) {


L.EditingContext = function(map) {
    var self = {map: map};

    self.dispatch = L.Dispatch(self);

    self.download_layer = new OpenLayers.Layer.Vector('Edit', {});
    self.map.addLayer(self.download_layer);

    self.edit_control = new OpenLayers.Control.ModifyFeature(self.download_layer, {
        vertexRenderIntent: 'temporary',
        mode: OpenLayers.Control.ModifyFeature.RESIZE |
              OpenLayers.Control.ModifyFeature.RESHAPE |
              OpenLayers.Control.ModifyFeature.DRAG
    });
    self.map.addControl(self.edit_control);
    self.edit_control.activate();

    var bounds = self.map.calculateBounds().scale(0.5);
    var box = new OpenLayers.Feature.Vector(bounds.toGeometry());
    self.download_layer.addFeatures([box]);
    self.edit_control.selectControl.select(box);

    self._last_generated_id = 0;
    self.generate_id = function() {
        self._last_generated_id -= 1;
        return self._last_generated_id;
    };

    var download_button = $('<a href="#" class="button">').text('download');
    self.node_layer = new OpenLayers.Layer.Vector('Nodes', {});
    self.node_layer.styleMap =  new OpenLayers.StyleMap({
        "default": new OpenLayers.Style({
            pointRadius: "15",
            fillColor: "#ffcc66",
            fillOpacity: 0.5,
            strokeColor: "#ff9933",
            strokeWidth: 2,
            graphicZIndex: 1
        }),
        "select": new OpenLayers.Style({
            fillColor: "#66ccff",
            strokeColor: "#3399ff",
            graphicZIndex: 2
        })
    });

    self.way_layer = new OpenLayers.Layer.Vector('Ways', {});
    download_button.click(function(evt) {
        evt.preventDefault();
        L.hide_message();
        self.edit_control.deactivate();
        self.map.removeControl(self.edit_control);
        self.download_layer.removeFeatures([box]);
        self.map.removeLayer(self.download_layer);
        var b = L.invproj(box.geometry.bounds);
        var bbox = b.left + ',' + b.bottom + ',' + b.right + ',' + b.top;
        L.download(bbox).done(function(data) {
            self.original_data = $('osm', data)[0];
            self.current_data = $(self.original_data).clone()[0];
            $(self.current_data).attr('generator', L.xml_signature);
            self.node_map = {};
            self.diff = function() {
                return L.xml_diff(self.original_data, self.current_data);
            };
            self.dispatch({type: 'osm_loaded'});
            self.map.addLayers([self.node_layer, self.way_layer]);
            self.display_osm(self.current_data);

            self.draw_node_control = new OpenLayers.Control.DrawFeature(
                self.node_layer, OpenLayers.Handler.Point);
            self.map.addControl(self.draw_node_control);
            self.draw_node_control.events.register('featureadded', null, function(evt) {
                var feature = evt.feature;
                var coords = L.invproj(feature.geometry.clone());
                var node = L.xml_node('node');
                $(node).attr({
                    lon: coords.x,
                    lat: coords.y,
                    id: self.generate_id(),
                    version: 1
                });
                $(self.current_data).append(node);
                self.display_osm_node(node, feature);
                self.draw_node_control.deactivate();
                self.select_control.activate();
                self.modify_control.activate();
                self.select_control.select(feature);
            });

            self.node_create = new L.NodeCreate;
            self.node_create.$el.insertAfter($('#menu'));
            self.node_create.on('create_node', function() {
                self.select_control.deactivate();
                self.modify_control.deactivate();
                self.draw_node_control.activate();
            });

            self.modify_control = new OpenLayers.Control.ModifyFeature(
                self.node_layer,
                {standalone: true});
            self.map.addControl(self.modify_control);
            self.modify_control.activate();

            self.node_layer.events.on({
                'featuremodified': function(evt) {
                    var feature = evt.feature;
                    var new_position = L.invproj(feature.geometry.clone());
                    self.node_view.update_position(new_position);
                    var way_features = $(feature.osm_node).data('view-ways');
                    self.way_layer.eraseFeatures(way_features);
                    $.each(way_features, function(i, feature) {
                        self.way_layer.drawFeature(feature);
                    });
                }
            });

            self.select_control = new OpenLayers.Control.SelectFeature(
                self.node_layer,
                {
                    onSelect: self.modify_control.selectFeature,
                    onUnselect: self.modify_control.unselectFeature,
                    scope: self.modify_control
                });
            self.select_control.events.on({
                'featurehighlighted': function(e) {
                    self.node_create.hide();
                    var feature = e.feature;
                    var node_model = new L.NodeModel({}, {xml: feature.osm_node});
                    self.node_view = new L.NodeView({model: node_model});
                    self.node_view.on('close', function() {
                        self.node_view.$el.remove();
                        self.node_view = null;
                        self.select_control.unselect(feature);
                    });
                    self.node_view.on('remove', function() {
                        var node = feature.osm_node
                        self.node_layer.eraseFeatures([feature]);
                        var way_features = $(node).data('view-ways');
                        self.way_layer.eraseFeatures(way_features);
                        $.each(way_features, function(i, way_feature) {
                            way_feature.geometry.removeComponent(feature.geometry);
                            self.way_layer.drawFeature(way_feature);
                        });
                    });
                    self.node_view.$el.insertAfter($('#menu'));
                },
                'featureunhighlighted': function(e) {
                    if(self.node_view) self.node_view.close();
                    self.node_create.show();
                }
            });
            self.map.addControl(self.select_control);
            self.select_control.activate();
        });
    });
    L.message("Select area then click ", download_button);

    self.display_osm_node = function(node, feature) {
        var $node = $(node);
        if(! feature) {
            var lon = $node.attr('lon'),
                lat = $node.attr('lat');
            var point = new OpenLayers.Geometry.Point(lon, lat);
            feature = new OpenLayers.Feature.Vector(L.proj(point));
            self.node_layer.addFeatures([feature]);
        }
        feature.osm_node = node;
        $node.data('view-feature', feature);
        $node.data('view-ways', []);
        self.node_map[$node.attr('id')] = node;
    };

    self.display_osm_way = function(way, feature) {
        if(! feature) {
            var line_string = new OpenLayers.Geometry.LineString();
            $('> nd', way).each(function(i, nd) {
                var node = self.node_map[$(nd).attr('ref')];
                var node_feature = $(node).data('view-feature');
                line_string.addComponent(node_feature.geometry);
            });
            feature = new OpenLayers.Feature.Vector(line_string);
            self.way_layer.addFeatures([feature]);
        }
        feature.osm_way = way;
        $('> nd', way).each(function(i, nd) {
            var node = self.node_map[$(nd).attr('ref')];
            $(node).data('view-ways').push(feature);
        });
    };

    self.display_osm = function(osm_doc) {
        $('> node', osm_doc).each(function() {
            self.display_osm_node(this);
        });

        $('> way', osm_doc).each(function() {
            self.display_osm_way(this);
        });
    };

    return self;
};

L.xml_node = function(tag_name) {
    return $.parseXML('<' + tag_name + '/>').firstChild;
};


L.NodeModel = Backbone.Model.extend({

    initialize: function(attributes, options) {
        this.xml = options['xml'];
        this.$xml = $(this.xml);
        this.set({
            lat: this.$xml.attr('lat'),
            lon: this.$xml.attr('lon')
        });
        this.id = this.$xml.attr('id');
    }

});


L.NodeView = Backbone.View.extend({

    className: 'node-properties',

    events: {
        'click .close.button': 'close',
        'click .new.button': 'new_tag',
        'click .delete.button': 'delete'
    },

    initialize: function() {
        this.render();
    },

    render: function() {
        $('.node-view-info', this.el).remove();
        var template = L.template['node-view-info'];
        var tmpl_data = _({id: this.model.id}).extend(this.model.attributes);
        this.$el.prepend(template(tmpl_data));
        if($('table.node-tags', this.el).length < 1) {
            this.render_table();
        }
    },

    render_table: function() {
        var tags_data = _($('> tag', this.model.xml)).map(function(tag_xml) {
            return {
                'key': $(tag_xml).attr('k'),
                'value': $(tag_xml).attr('v')
            };
        });
        this.$el.append(L.template['tags-table']({'tags': tags_data}));
    },

    new_tag: function(evt) {
        evt.preventDefault();
        var tag_html = L.template['tag-tr']({'key': "", 'value': ""});
        $('table.node-tags', this.el).append(tag_html);
    },

    save: function() {
        $('> tag', this.model.xml).remove();
        $('tr.tag', this.el).each(_(function(i, tr) {
            var key = $('input[name=key]', tr).val();
            var value = $('input[name=value]', tr).val();
            if(key && value) {
                var tag = $(L.xml_node('tag')).attr({k: key, v: value});
                this.model.$xml.append(tag);
            }
        }).bind(this));
    },

    update_position: function(new_position) {
        this.model.set('lon', new_position.x);
        this.model.set('lat', new_position.y);
        this.render();
    },

    delete: function(evt) {
        evt.preventDefault();
        this.close()
        this.trigger('remove');
        this.model.$xml.remove();
    },

    close: function(evt) {
        if(evt) { evt.preventDefault(); }
        this.save();
        this.trigger('close');
    }

});


L.NodeCreate = Backbone.View.extend({

    templateName: 'node-create',
    className: 'node-properties',

    events: {
        'click .node-create-button a': 'buttonClick'
    },

    initialize: function() {
        this.render();
    },

    render: function() {
        this.$el.html(L.template[this.templateName]({model: this.model}));
    },

    buttonClick: function(evt) {
        evt.preventDefault();
        $('.node-create-button', this.el).hide();
        $('.node-create-message', this.el).show();
        this.trigger('create_node');
    },

    show: function() {
        $('.node-create-message', this.el).hide();
        $('.node-create-button', this.el).show();
        this.$el.show();
    },

    hide: function() {
        this.$el.hide();
    }

});


})(window.L);
