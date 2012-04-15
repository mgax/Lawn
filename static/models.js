(function(L) {


L.NodeModel = Backbone.Model.extend({
    initialize: function(attributes, options) {
        this.xml = options['xml'];
        this.$xml = $(this.xml);
        var tags = _(this.$xml.find('> tag')).map(function(tag_xml) {
            return {
                key: $(tag_xml).attr('k'),
                value: $(tag_xml).attr('v')
            }
        });
        this.set({
            lat: this.$xml.attr('lat'),
            lon: this.$xml.attr('lon'),
            tags: tags
        });
        this.id = this.$xml.attr('id');
        this.ways = new Backbone.Collection;
    },

    update_tags: function(new_tags) {
        if(_(new_tags).isEqual(this.get('tags'))) {
            return; }
        this.$xml.find('> tag').remove();
        _(new_tags).forEach(function(tag) {
            var attr = {k: tag['key'], v: tag['value']};
            var tag_xml = $(L.xml_node('tag', attr));
            this.$xml.append(tag_xml);
        }, this);
        this.set({tags: new_tags});
    },

    make_tag_collection: function() {
        var tag_collection = new Backbone.Collection;
        _(this.get('tags')).forEach(function(tag_data) {
            tag_collection.add(new Backbone.Model(tag_data));
        });
        tag_collection.on('change add remove', function() {
            this.update_tags(tag_collection.toJSON());
        }, this);
        return tag_collection;
    },

    update_position: function(new_position) {
        this.$xml.attr(new_position);
        this.set(new_position);
    },

    destroy: function() {
        this.trigger('destroy', this);
    }
});


L.WayModel = Backbone.Model.extend({
    initialize: function(attributes, options) {
        this.xml = options['xml'];
        this.$xml = $(this.xml);
        this.id = this.$xml.attr('id');
        this.nodes = new Backbone.Collection(
            _(this.$xml.find('> nd')).map(function(nd_xml) {
                var node_id = $(nd_xml).attr('ref');
                var node = options['nodes'].get(node_id);
                node.ways.add(this);
                return node;
            }, this));
        this.nodes.on('destroy', function(node) {
            this.$xml.find('> nd[ref="' + node.id + '"]').remove();
        }, this);
    }
});


L.LayerModel = Backbone.Model.extend({
    initialize: function(attributes, options) {
        this.xml = options['xml'];
        this.$xml = $(this.xml);

        this.nodes = new Backbone.Collection(
            _(this.$xml.find('> node')).map(function(node_xml) {
                return new L.NodeModel({}, {xml: node_xml});
            }));

        this.ways = new Backbone.Collection(
            _(this.$xml.find('> way')).map(function(way_xml) {
                return new L.WayModel({}, {
                    xml: way_xml,
                    nodes: this.nodes
                });
            }, this));

        this.nodes.on('add', function(node) {
            this.$xml.append(node.xml);
        }, this);

        this.nodes.on('destroy', function(node) {
            node.$xml.remove();
        });

        function propagate_events() {
            this.trigger.apply(this, arguments);
        }
        this.nodes.on('all', propagate_events, this);
        this.ways.on('all', propagate_events, this);
    }
});


})(window.L);
