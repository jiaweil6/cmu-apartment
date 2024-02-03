
// Initialize and add the map
function initMap() {
  // Create an object holding the latitude and longitude of Carnegie Mellon University
  var cmu = {lat: 40.4481986, lng: -79.9382407};

  // Instantiate a map and platform object:
  var platform = new H.service.Platform({
      'apikey': 'BYKeCDXHyh3JrJt_t8zYjEK_nS_WhWcen7aQ0rtY05A' // Replace with your HERE API key
  });
  var defaultLayers = platform.createDefaultLayers();

  // Instantiate the map:
  var map = new H.Map(document.getElementById('mapContainer'),
      defaultLayers.vector.normal.map, {
      center: cmu,
      zoom: 14.5,
      pixelRatio: window.devicePixelRatio || 1
  });

  // Make the map interactive
  // MapEvents enables the event system
  // Behavior implements default interactions for pan/zoom (also on mobile touch environments)
  var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

  // Create the default UI components
  var ui = H.ui.UI.createDefault(map, defaultLayers);

  // Now the map will be interactive allowing the user to pan and zoom the map

  var iconUrl = 'https://cdn-icons-png.flaticon.com/128/684/684908.png'
  // Function to add a marker for an apartment
  function addApartmentMarker(apartment) {
    // Create a scaled-down icon
    var icon = new H.map.Icon(iconUrl, {size: {w: 24, h: 24}});
    
    // Create a marker with the scaled-down icon
    var marker = new H.map.Marker({
      lat: apartment.Latitude,
      lng: apartment.Longitude
    }, { icon: icon });
  
    // Create a text label for the apartment
    var textLabel = new H.map.DomIcon(`<a style="font-size: 10px; color: #c81238;" href=${apartment.Website}>${apartment.Name}</a>`); // Adjust the font-size as needed
  
    // Create a DOM marker to show the text label
    var domMarker = new H.map.DomMarker({
      lat: apartment.Latitude,
      lng: apartment.Longitude
    }, {
      icon: textLabel
    });
  
    // Add both the icon marker and the text label to the map
    map.addObject(marker);
    map.addObject(domMarker);
  }
  

  // Loop through apartmentsData to add each as a marker on the map
  apartmentsData.forEach(addApartmentMarker);

  // Adjust the map view to ensure all markers are visible
  map.getViewModel().setLookAtData({
    bounds: map.getObjects().reduce(function (bounds, marker) {
      return bounds.extend(marker.getGeometry());
    }, new H.geo.Rect())
  });
}

// Call the map initialization function when the window has loaded
window.onload = initMap;

const apartmentsData = [
  {
    "Name": "SkyVue",
    "Website": "https://www.skyvueapts.com/",
    "Latitude": "40.4391042",
    "Longitude": "-79.9643248"
  },
  {
    "Name": "One on Center",
    "Website": "https://www.oneoncentre.com/",
    "Latitude": "40.451418",
    "Longitude": "-79.9557349"
  },
  {
    "Name": "Bridge on Forbes",
    "Website": "https://thebridgeonforbes.com/",
    "Latitude": "40.4388382",
    "Longitude": "-79.9635423"
  },
  {
    "Name": "Sherwood Towers",
    "Website": "https://www.sherwoodtowers.com/",
    "Latitude": "40.4510414",
    "Longitude": "-79.9536384"
  },
  {
    "Name": "Webster Hall",
    "Website": "https://www.websterhallapartments.com/",
    "Latitude": "40.4470621",
    "Longitude": "-79.9534939"
  },
  {
    "Name": "Amberson Gardens",
    "Website": "https://www.apartments.com/amberson-gardens-pittsburgh-pa/w2vgfbj/",
    "Latitude": "40.4532841",
    "Longitude": "-79.9454667"
  },
  {
    "Name": "Essex House",
    "Website": "https://mcquartersrealty.com/apartments/essex-house/",
    "Latitude": "40.457671",
    "Longitude": "-79.9360425"
  },
  {
    "Name": "Claybourne",
    "Website": "https://mcquartersrealty.com/apartments/claybourne-apartments/",
    "Latitude": "40.455539",
    "Longitude": "-79.93912"
  },
  {
    "Name": "Coda on Center",
    "Website": "https://codaoncentre.com",
    "Latitude": "40.4579353",
    "Longitude": "-79.9323272"
  },
  {
    "Name": "Industry Pittsburgh",
    "Website": "https://industry-pittsburgh.com",
    "Latitude": "40.4583596",
    "Longitude": "-79.9312796"
  },
  {
    "Name": "Walnut on Highland",
    "Website": "https://www.walnutonhighland.com/",
    "Latitude": "40.4602129",
    "Longitude": "-79.924797"
  },
  {
    "Name": "Eastside Bond",
    "Website": "https://www.eastsidebond.com/",
    "Latitude": "40.4599747",
    "Longitude": "-79.9257807"
  },
  {
    "Name": "Bakery Living",
    "Website": "https://www.bakeryliving.com/",
    "Latitude": "40.4555746",
    "Longitude": "-79.9194839"
  },
  {
    "Name": "Kenmawr",
    "Website": "https://www.pmcpropertygroup.com/properties/kenmawr-apartments",
    "Latitude": "40.4552298",
    "Longitude": "-79.9237069"
  },
  {
    "Name": "Maxon Towers",
    "Website": "https://www.maxontowers.com/",
    "Latitude": "40.4381887",
    "Longitude": "-79.9210128"
  },
  {
    "Name": "Negley Court",
    "Website": "https://www.apartments.com/negley-court-pittsburgh-pa/k28meyb/",
    "Latitude": "40.4494115",
    "Longitude": "-79.9323159"
  },
  {
    "Name": "Camelot",
    "Website": "https://www.camelot-apartments.com/",
    "Latitude": "40.4509291",
    "Longitude": "-79.9550979"
  }
]