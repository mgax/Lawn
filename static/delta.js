(function(L) {

// http://wiki.openstreetmap.org/wiki/OsmChange


L.xml_diff = function(osm1, osm2) {
    // TODO set `changeset` and `version` attributes for each node

    var delta_create = [];
    var delta_modify = [];
    var delta_delete = [];

    var nodes1 = {};
    $('> node', osm1).each(function() {
        nodes1[$(this).attr('id')] = this;
    });
    $('> node', osm2).each(function() {
        var node2 = $(this);
        var id = node2.attr('id');
        var node1 = nodes1[id];
        if(! node1) {
            delta_create.push(node2);
        }
        else if(node_changed(node1, node2)) {
            delta_modify.push(node2);
        }
        delete nodes1[id];
    });
    $.each(nodes1, function() {
        delta_delete.push($(this));
    });

    var ways1 = {};
    $('> way', osm1).each(function() {
        ways1[$(this).attr('id')] = this;
    });
    $('> way', osm2).each(function() {
        var way2 = $(this);
        var id = way2.attr('id');
        var way1 = ways1[id];
        if(! way1) {
            delta_create.push(way2);
        }
        else if(way_changed(way1, way2)) {
            delta_modify.push(way2);
        }
        delete ways1[id];
    });
    $.each(ways1, function() {
        delta_delete.push($(this));
    });

    var delta = L.xml_node('osmChange');
    $(delta).attr('version', '0.6');

    function add_delta_bag(parent_node, name, list) {
        if(! list.length) {
            return;
        }
        var bag = $(L.xml_node(name)).appendTo(parent_node);
        $.each(list, function() {
            var node = $(this).clone();
            bag.append(node);
        });
    }

    add_delta_bag(delta, 'create', delta_create);
    add_delta_bag(delta, 'modify', delta_modify);
    add_delta_bag(delta, 'delete', delta_delete);

    if(delta.firstChild == null) {
        return null;
    }
    return delta;
};


function node_changed(node1, node2) {
    if( ($(node1).attr('lon') != $(node2).attr('lon')) ||
        ($(node1).attr('lat') != $(node2).attr('lat')) ) {
        return true;
    }
    var has_changed = false;
    var tags1 = {};
    var n1 = 0, n2 = 0;
    $('> tag', node1).each(function() {
        var tag1 = $(this);
        tags1[tag1.attr('k')] = tag1.attr('v');
        n1 += 1;
    });
    $('> tag', node2).each(function() {
        var tag2 = $(this);
        var key = tag2.attr('k');
        if(tags1[key] != tag2.attr('v')) {
            has_changed = true;
        }
        n2 += 1;
    });
    if(n1 != n2) {
        has_changed = true;
    }
    return has_changed;
}


function way_changed(way1, way2) {
    var nodes1 = '', nodes2 = '';
    $('nd', way1).each(function(i, nd) { nodes1 += $(nd).attr('ref') + ','; });
    $('nd', way2).each(function(i, nd) { nodes2 += $(nd).attr('ref') + ','; });
    if(nodes1 != nodes2) {
        return true;
    }
}


})(window.L);
