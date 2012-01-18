(function(L) {


L.xml_diff = function(osm1, osm2) {
    // TODO set `changeset` and `version` attributes for each node

    var nodes1 = {};
    $('> node', osm1).each(function() {
        nodes1[$(this).attr('id')] = this;
    });

    var nodes_create = [];
    var nodes_modify = [];
    var nodes_delete = [];
    $('> node', osm2).each(function() {
        var node2 = $(this);
        var id = node2.attr('id');
        var node1 = nodes1[id];
        if(nodes1 == null) {
            nodes_create.push(node2);
        }
        else if(node_changed(node1, node2)) {
            nodes_modify.push(node2);
        }
        delete nodes1[id];
    });

    $.each(nodes1, function() {
        nodes_delete.push($(this));
    });

    var delta = L.xml_node('osmChange');

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

    add_delta_bag(delta, 'create', nodes_create);
    add_delta_bag(delta, 'modify', nodes_modify);
    add_delta_bag(delta, 'delete', nodes_delete);

    if(delta.firstChild == null) {
        return null;
    }
    return delta.parentNode; // return an XML Document object
};


function node_changed(node1, node2) {
    // TODO check lat, lon
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


})(window.L);