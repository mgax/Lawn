(function(L) {


L.node_style_map = new OpenLayers.StyleMap({
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

L.geometry_for_node = function(node_model) {
    return new OpenLayers.Geometry.Point(
        node_model.get('lon'),
        node_model.get('lat'));
};

L.update_point = function(point, new_data) {
    point.x = new_data.x;
    point.y = new_data.y;
    point.clearBounds();
}


L.NodeVector = Backbone.View.extend({

    initialize: function(options) {
        this.layer_vector = options['layer_vector'];
        this.geometry = L.proj(L.geometry_for_node(this.model));
        this.feature = options['feature'];
        if(! this.feature) {
            this.feature = new OpenLayers.Feature.Vector(this.geometry);
        }
        this.feature.L_vector = this;
        this.on('vertexmodified', this.save_position, this);
        this.model.on('change', this.redraw_position_if_changed, this);
    },

    save_position: function() {
        var new_position = L.invproj(this.geometry.clone());
        var values = {'lon': new_position.x, 'lat': new_position.y};
        this.model.update_position(values, {'from_vector_edit': true});
    },

    redraw_position_if_changed: function(node, options) {
        if(options['from_vector_edit']) { return; }
        if(!(options['changes']['lat'] ||
             options['changes']['lon'])) {
            return;
        }
        L.update_point(this.geometry, L.proj(L.geometry_for_node(this.model)));
        this.trigger('geometry_change', this);
    }

});


L.WayVector = Backbone.View.extend({

    initialize: function(options) {
        this.layer_vector = options['layer_vector'];

        this.node_id_to_geometry = {};
        this.geometry_id_to_node = {};
        this.line_string = new OpenLayers.Geometry.LineString();

        this.model.nodes.forEach(this.add_node, this);
        this.model.nodes.on('add', this.add_node, this);
        this.model.nodes.on('remove', this.remove_node, this);
        this.model.nodes.on('change', this.node_change, this);

        this.on('featuremodified', this.update_node_list, this);

        this.feature = new OpenLayers.Feature.Vector(this.line_string);
        this.feature.L_vector = this;
    },

    add_node: function(node_model, collection, options) {
        var point_geometry = L.proj(L.geometry_for_node(node_model));
        if(options && options['inserted_by_modify_feature']) {
            var idx = options ? options['index'] : null;
            var tmp_component = this.line_string.components[idx];
            this.line_string.removeComponent(tmp_component);
            this.line_string.addComponent(point_geometry, idx);
        }
        else {
            this.line_string.addComponent(point_geometry);
        }
        this.node_id_to_geometry[node_model.id] = point_geometry;
        this.geometry_id_to_node[point_geometry.id] = node_model;
        this.trigger('geometry_change', this);
    },

    remove_node: function(node_model) {
        var point = _(this.node_id_to_geometry).pop(node_model.id);
        _(this.geometry_id_to_node).pop(point.id);
        this.feature.geometry.removeComponent(point);
        this.trigger('geometry_change', this);
    },

    node_change: function(node_model, options) {
        if(!(options['changes']['lat'] ||
             options['changes']['lon'])) {
            return;
        }
        L.update_point(this.node_id_to_geometry[node_model.id],
                       L.proj(L.geometry_for_node(node_model)));
        this.trigger('geometry_change', this);
    },

    update_node_list: function() {
        var point_list = this.feature.geometry.components;
        _(point_list).map(function(point) {

            var point_idx = _(point.parent.components).indexOf(point);
            var coords = L.invproj(point.clone());
            var node = this.geometry_id_to_node[point.id];

            if(node) {
                node.update_position({
                    'lon': coords.x,
                    'lat': coords.y
                });
            }
            else {
                var node = this.layer_vector.model.create_node({
                    'lon': coords.x,
                    'lat': coords.y
                });
                this.model.nodes.add(node, {
                    'at': point_idx,
                    'inserted_by_modify_feature': true
                });
            }

        }, this);
    }

});


L.LayerVector = Backbone.View.extend({
    initialize: function() {
        this.node_vectors = {};
        this.node_layer = new OpenLayers.Layer.Vector('Nodes', {});
        this.model.nodes.forEach(this.add_node, this);
        this.model.nodes.on('add', this.add_node, this);
        this.model.nodes.on('remove', this.remove_node, this);

        this.node_layer.events.on({
            'vertexmodified': function(evt) {
                var vector_view = evt['feature']['L_vector'];
                vector_view.trigger('vertexmodified', evt['vertex']);
            },
            'featuremodified': function(evt) {
                var vector_view = evt['feature']['L_vector'];
                vector_view.trigger('featuremodified');
            }
        });

        this.way_vectors = {};
        this.way_layer = new OpenLayers.Layer.Vector('Ways', {});
        this.model.ways.forEach(this.add_way, this);
        this.model.ways.on('add', this.add_way, this);
    },

    add_node: function(node_model, collection, options) {
        var node_vector = new L.NodeVector({
            layer_vector: this,
            model: node_model,
            feature: options['feature']
        });
        this.node_vectors[node_model.id] = node_vector;
        this.node_layer.addFeatures([node_vector.feature]);
        node_vector.on('geometry_change', this.geometry_change, this);
    },

    remove_node: function(node_model) {
        var node_feature = this.node_vectors[node_model.id].feature;
        this.node_layer.removeFeatures([node_feature]);
    },

    add_way: function(way_model) {
        var way_vector = new L.WayVector({
            layer_vector: this,
            model: way_model
        });
        this.way_vectors[way_model.id] = way_vector;
        this.way_layer.addFeatures([way_vector.feature]);
        way_vector.on('geometry_change', this.geometry_change, this);
    },

    geometry_change: function(vector_view) {
        if(vector_view.feature) {
            var feature = vector_view.feature;
            feature.layer.drawFeature(feature);
        }
    }
});


L.TagView = Backbone.View.extend({

    events: {
        'click .new.button': 'new_tag',
        'change tr.tag': 'tag_change'
    },

    initialize: function() {
        this.render();
    },

    render: function() {
        this.$el.html(L.template['tags-table']({tag_collection: this.model}));
    },

    new_tag: function(evt) {
        evt.preventDefault();
        var new_tag = new Backbone.Model({'key': "", 'value': ""})
        this.model.add(new_tag);
        var tag_html = L.template['tag-tr']({model: new_tag});
        $('table.node-tags', this.el).append(tag_html);
    },

    save_tag: function(tr) {
        var $tr = $(tr);
        var tag_model = this.model.getByCid($tr.data('cid'));
        var key = $tr.find('input[name=key]').val();
        var value = $tr.find('input[name=value]').val();
        if(key) {
            tag_model.set({'key': key, 'value': value});
        }
        else {
            this.model.remove(tag_model);
            $tr.remove();
        }
    },

    tag_change: function(evt) {
        this.save_tag($(evt.target).parents('tr.tag')[0]);
    },

    save_to_model: function() {
        _(this.$el.find('tr.tag')).forEach(function(tr) {
            this.save_tag(tr);
        }, this);
    }

});


L.NodeView = Backbone.View.extend({

    events: {
        'click .close.button': 'close',
        'click .delete.button': 'delete'
    },

    initialize: function() {
        this.tags = new L.TagView({
            model: this.model.make_tag_collection()
        });
        this.render();
        this.model.on('change', this.render, this);
    },

    render: function() {
        var tmpl_data = _({id: this.model.id}).extend(this.model.attributes);
        this.$el.html(L.template['node-view-info'](tmpl_data));
        this.$el.find('div.node-tags-placeholder').replaceWith(this.tags.$el);
        this.tags.delegateEvents();
    },

    delete: function(evt) {
        evt.preventDefault();
        this.close()
        this.model.destroy();
    },

    close: function(evt) {
        if(evt) { evt.preventDefault(); }
        this.tags.save_to_model();
        this.trigger('close');
    }

});


L.WayView = Backbone.View.extend({

    events: {
        'click .close.button': 'close'
    },

    initialize: function() {
        this.tags = new L.TagView({
            model: this.model.make_tag_collection()
        });
        this.render();
    },

    render: function() {
        var tmpl_data = _({id: this.model.id}).extend(this.model.attributes);
        this.$el.html(L.template['way-view-info'](tmpl_data));
        this.$el.find('div.way-tags-placeholder').replaceWith(this.tags.$el);
        this.tags.delegateEvents();
    },

    close: function(evt) {
        if(evt) { evt.preventDefault(); }
        this.trigger('close');
    }

});


L.NodeCreate = Backbone.View.extend({

    templateName: 'node-create',

    events: {
        'click .node-create-button a': 'buttonClick'
    },

    initialize: function(options) {
        this.layer_vector = options['layer_vector'];
        this.generate_id = options['generate_id'];
        this.draw_node_control = new OpenLayers.Control.DrawFeature(
            this.layer_vector.node_layer,
            OpenLayers.Handler.Point);
        this.draw_node_control.events.register('featureadded',
            this, this.feature_added);
        this.render();
    },

    render: function() {
        this.$el.html(L.template[this.templateName]());
    },

    buttonClick: function(evt) {
        evt.preventDefault();
        $('.node-create-button', this.el).hide();
        $('.node-create-message', this.el).show();
        this.trigger('begin_create_node');
        this.draw_node_control.activate();
    },

    show: function() {
        $('.node-create-message', this.el).hide();
        $('.node-create-button', this.el).show();
        this.$el.show();
    },

    hide: function() {
        this.$el.hide();
    },

    feature_added: function(evt) {
        var node_feature = evt.feature;
        var coords = L.invproj(node_feature.geometry.clone());
        this.model.create_node({
            lon: coords.x,
            lat: coords.y,
            feature: node_feature
        });
        this.draw_node_control.deactivate();
        this.trigger('create_node', {feature: node_feature});
    }
});


L.VectorEdit = Backbone.View.extend({
    initialize: function(options) {
        this.layer_vector = options['layer_vector'];
        this.modify_control = new OpenLayers.Control.ModifyFeature(
            this.layer_vector.node_layer,
            {standalone: true});
        this.select_control = new OpenLayers.Control.SelectFeature(
            [this.layer_vector.node_layer, this.layer_vector.way_layer],
            {
                'onSelect': this.modify_control.selectFeature,
                'onUnselect': this.modify_control.unselectFeature,
                scope: this.modify_control
            });
        this.select_control.events.on({
            'featurehighlighted': function(e) {
                this.trigger('select', e.feature);
            },
            'featureunhighlighted': function(e) {
                this.trigger('deselect');
            },
            scope: this
        });
    },

    activate: function() {
        this.select_control.activate();
        this.modify_control.activate();
    },

    deactivate: function() {
        this.select_control.deactivate();
        this.modify_control.deactivate();
    }
});


L.LayerEditor = Backbone.View.extend({

    className: 'layer_editor-buttons',

    element_view_cls: {
        'node': L.NodeView,
        'way': L.WayView
    },

    initialize: function(options) {
        this.map = options['map'];
        this.vector = new L.LayerVector({model: this.model});
        this.vector.node_layer.styleMap = L.node_style_map;
        this.map.addLayers([this.vector.node_layer, this.vector.way_layer]);

        this.node_create = new L.NodeCreate({
            model: this.model,
            layer_vector: this.vector
        });
        this.map.addControl(this.node_create.draw_node_control);
        this.node_create.$el.appendTo(this.el);

        this.vector_edit = new L.VectorEdit({layer_vector: this.vector});
        this.vector_edit.on('select', function(feature) {
            this.node_create.hide();
            var element_model = feature.L_vector.model;
            var view_cls = this.element_view_cls[element_model.type];
            this.element_view = new view_cls({model: element_model});
            this.element_view.on('close', function() {
                this.element_view.$el.remove();
                this.element_view = null;
                this.vector_edit.select_control.unselect(feature);
            }, this);
            this.element_view.$el.appendTo(this.el);
        }, this);
        this.vector_edit.on('deselect', function() {
            if(this.element_view) {
                this.element_view.close();
            }
            this.node_create.show();
        }, this);

        this.map.addControls([this.vector_edit.modify_control,
                              this.vector_edit.select_control]);
        this.vector_edit.activate();

        this.node_create.on('begin_create_node', function() {
            this.vector_edit.deactivate();
        }, this);
        this.node_create.on('create_node', function(options) {
            this.vector_edit.activate();
            this.vector_edit.select_control.select(options['feature']);
        }, this);
    }

});


})(window.L);
