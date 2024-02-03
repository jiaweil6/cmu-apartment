// Initialize and add the map
function initMap() {
  // Create an object holding the latitude and longitude of Carnegie Mellon University
  var cmu = {lat: 40.4433, lng: -79.9436};

  // Instantiate a map and platform object:
  var platform = new H.service.Platform({
      'apikey': 'BYKeCDXHyh3JrJt_t8zYjEK_nS_WhWcen7aQ0rtY05A' // Replace with your HERE API key
  });
  var defaultLayers = platform.createDefaultLayers();

  // Instantiate the map:
  var map = new H.Map(document.getElementById('mapContainer'),
      defaultLayers.vector.normal.map, {
      center: cmu,
      zoom: 14,
      pixelRatio: window.devicePixelRatio || 1
  });

  // Make the map interactive
  // MapEvents enables the event system
  // Behavior implements default interactions for pan/zoom (also on mobile touch environments)
  var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

  // Create the default UI components
  var ui = H.ui.UI.createDefault(map, defaultLayers);

  // Now the map will be interactive allowing the user to pan and zoom the map
}

// Call the map initialization function when the window has loaded
window.onload = initMap;
