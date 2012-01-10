$(document).ready(function() {

var wgs84 = new OpenLayers.Projection("EPSG:4326");
function project_to_map(lonlat) {
    var map_proj = map.getProjectionObject();
    return lonlat.transform(wgs84, map_proj);
}

var map = new OpenLayers.Map('map');
map.addLayer(new OpenLayers.Layer.OSM("OpenStreetMap"));
map.setCenter(project_to_map(new OpenLayers.LonLat(26.082, 44.475)), 16);

});
