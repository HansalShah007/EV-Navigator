// Setting up environment for range prediction model
var inputs_range = [
    parseFloat(localStorage.getItem("norm_cap")),
    parseFloat(localStorage.getItem("city")),
    parseFloat(localStorage.getItem("highway")),
    parseFloat(localStorage.getItem("country")),
    parseFloat(localStorage.getItem("a/c")),
    parseFloat(localStorage.getItem("heater")),
    parseFloat(localStorage.getItem("winter")),
    parseFloat(localStorage.getItem("moderate")),
    parseFloat(localStorage.getItem("fast")),
    0
]

var max_range_inputs = [
    parseFloat(localStorage.getItem("norm_cap")),
    0,
    1,
    0,
    0,
    0,
    parseFloat(localStorage.getItem("winter")),
    parseFloat(localStorage.getItem("moderate")),
    parseFloat(localStorage.getItem("fast")),
    0
]

var avg_speed_mean = 42.292001, avg_speed_std = 12.537601
var Range_model
async function load_model() {
    Range_model = await tf.loadLayersModel('./Model_Range/JSON/model.json');
}
load_model()


//set map options
var myLatLng = { lat: 38.3460, lng: -0.4907 };
var mapOptions = {
    center: myLatLng,
    zoom: 7,
    mapTypeId: google.maps.MapTypeId.ROADMAP
};

//create map
var map = new google.maps.Map(document.getElementById('googleMap'), mapOptions);

// Initialize variables
var bounds = new google.maps.LatLngBounds();
var infoWindow = new google.maps.InfoWindow;
var currentInfoWindow = infoWindow;
/* TODO: Step 4A3: Add a generic sidebar */
var infoPane = document.getElementById('panel');

//create autocomplete objects for all inputs
var options = {
    types: ['(cities)']
}

var input2 = document.getElementById("to");
var autocomplete2 = new google.maps.places.Autocomplete(input2, options);

//define calcRoute function
function calcRoute() {

    //create a DirectionsService object to use the route method and get a result for our request
    var directionsService = new google.maps.DirectionsService();

    //create a DirectionsRenderer object which we will use to display the route
    var directionsDisplay = new google.maps.DirectionsRenderer();

    //bind the DirectionsRenderer to the map
    directionsDisplay.setMap(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {

            var request = {
                origin: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                },
                destination: document.getElementById("to").value,
                travelMode: google.maps.TravelMode.DRIVING, //WALKING, BYCYCLING, TRANSIT
                unitSystem: google.maps.UnitSystem.METRICS,
                provideRouteAlternatives: true,
            }

            //pass the request to the route method
            directionsService.route(request, function (result, status) {
                console.log(result)
                if (status == google.maps.DirectionsStatus.OK) {

                    // Estimating range for the EV
                    var avg_speed = Math.round(((result.routes[0].legs[0].distance.value / 1000) / (result.routes[0].legs[0].duration.value / 3600)) * 100) / 100
                    var norm_avg_speed = (avg_speed - avg_speed_mean) / avg_speed_std
                    inputs_range.pop()
                    max_range_inputs.pop()
                    inputs_range.push(norm_avg_speed)
                    max_range_inputs.push(norm_avg_speed)

                    let inputs_range_tensor = tf.tensor2d(inputs_range, [1, inputs_range.length])
                    let max_range_tensor = tf.tensor2d(max_range_inputs, [1, max_range_inputs.length])
                    var pred_range = Range_model.predict(inputs_range_tensor).arraySync()[0][0]
                    var max_range = Range_model.predict(max_range_tensor).arraySync()[0][0]
                    console.log('Predicted: ', pred_range)
                    console.log('Max range: ', max_range)

                    var alert = document.getElementById('output-message')
                    alert.innerHTML = ''

                    if (pred_range> Math.round((result.routes[0].legs[0].distance.value / 1000))) {
                        alert.innerHTML = `<div class="alert alert-success" role="alert">` +
                            `<h4 class="alert-heading">Location Reachable!</h4>` +
                            `<p>Destination range: ` + Math.round(result.routes[0].legs[0].distance.value / 1000) + ` km</p>` +
                            `<p>Range of car: ` + Math.round(pred_range * 100) / 100 + ` km</p>` +
                            `<p>Time required: ` + result.routes[0].legs[0].duration.text + `</p>` +
                            `<p>Maximum range of car: ` + Math.round(max_range * 100) / 100 + ` km</p>` +
                            `<hr>
                            <p class="mb-0">Still looking for charging stations?</p>
                            <button onclick="initMap()" type="button" class="btn btn-outline-dark" style="margin: 15px 0px 0px 0px;">Click Here</button>
                            </div>`
                    } else {
                        if(max_range> Math.round((result.routes[0].legs[0].distance.value / 1000))){
                            alert.innerHTML = `<div class="alert alert-danger" role="alert">` +
                                `<h4 class="alert-heading">Location Not Reachable!</h4>` +
                                `<p>Destination range: ` + Math.round(result.routes[0].legs[0].distance.value / 1000) + ` km</p>` +
                                `<p>Range of car: ` + Math.round(pred_range * 100) / 100 + ` km</p>` +
                                `<p>Time required: ` + result.routes[0].legs[0].duration.text + `</p>` +
                                `<p>Maximum range of car: ` + Math.round(max_range * 100) / 100 + ` km</p>` +
                                `<hr>
                                <p class="mb-0">The nearby charging stations are marked in the map below</p>
                                <p class="mb-0">Turn off the load (A/C or Heater) and try to take a route with only highways, in order to reach your location comfartably.</p>
                                </div>`
                        }
                        else{
                            alert.innerHTML = `<div class="alert alert-danger" role="alert">` +
                                `<h4 class="alert-heading">Location Not Reachable!</h4>` +
                                `<p>Destination range: ` + Math.round(result.routes[0].legs[0].distance.value / 1000) + ` km</p>` +
                                `<p>Range of car: ` + Math.round(pred_range * 100) / 100 + ` km</p>` +
                                `<p>Time required: ` + result.routes[0].legs[0].duration.text + `</p>` +
                                `<p>Maximum range of car: ` + Math.round(max_range * 100) / 100 + ` km</p>` +
                                `<hr>
                                <p class="mb-0">The nearby charging stations are marked in the map below</p>
                                </div>`
                        }
                        initMap()
                    }

                    //display route
                    directionsDisplay.setDirections(result);
                } else {

                    //delete route from map
                    directionsDisplay.setDirections({ routes: [] });
                    //center map in London
                    map.setCenter(myLatLng);


                    let warning = document.getElementById('output-message')
                    warning.innerHTML = `<div class="alert alert-danger alert-dismissible" role="alert">
                    <p>No path found!</p>
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>`
                }
            });

        },

            () => {
                // Browser supports geolocation, but user has denied permission
                handleLocationError(true);
            });

    }
    else {
        // Browser doesn't support geolocation
        handleLocationError(false);
    }
}

function initMap() {

    // Try HTML5 geolocation

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            console.log(position);
            var pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            map = new google.maps.Map(document.getElementById('googleMap'), {
                center: pos,
                zoom: 15
            });
            bounds.extend(pos);

            infoWindow.setPosition(pos);
            infoWindow.setContent('Current Location');
            infoWindow.open(map);
            map.setCenter(pos);

            // Call Places Nearby Search on user's location
            getNearbyPlaces(pos);
        }, () => {
            // Browser supports geolocation, but user has denied permission
            handleLocationError(true);
        });
    } else {
        // Browser doesn't support geolocation
        handleLocationError(false);
    }
}

// Handle a geolocation error
function handleLocationError(browserHasGeolocation) {
    // Set default location to Sydney, Australia
    var pos = { lat: -33.856, lng: 151.215 };
    map = new google.maps.Map(document.getElementById('map'), {
        center: pos,
        zoom: 15
    });

    // Display an InfoWindow at the map center
    infoWindow.setPosition(pos);
    infoWindow.setContent(browserHasGeolocation ?
        'Geolocation permissions denied. Using default location.' :
        'Error: Your browser doesn\'t support geolocation.');
    infoWindow.open(map);

    // Call Places Nearby Search on the default location
    getNearbyPlaces(pos);
}

var service = new google.maps.places.PlacesService(map);

// Perform a Places Nearby Search Request
function getNearbyPlaces(position) {
    let request = {
        location: position,
        rankBy: google.maps.places.RankBy.DISTANCE,
        keyword: 'petrol pump'
    };

    service.nearbySearch(request, nearbyCallback);
}

// Handle the results (up to 20) of the Nearby Search
function nearbyCallback(results, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
        createMarkers(results);
    }
}

// Set markers at the location of each place result
function createMarkers(places) {
    places.forEach(place => {
        let marker = new google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: place.name
        });

        /* TODO: Step 4B: Add click listeners to the markers */
        // Add click listener to each marker
        google.maps.event.addListener(marker, 'click', () => {
            let request = {
                placeId: place.place_id,
                fields: ['name', 'formatted_address', 'geometry', 'rating',
                    'website', 'photos']
            };

            /* Only fetch the details of a place when the user clicks on a marker.
             * If we fetch the details for all place results as soon as we get
             * the search response, we will hit API rate limits. */
            service.getDetails(request, (placeResult, status) => {
                showDetails(placeResult, marker, status)
            });
        });

        // Adjust the map bounds to include the location of this marker
        bounds.extend(place.geometry.location);
    });
    /* Once all the markers have been placed, adjust the bounds of the map to
     * show all the markers within the visible area. */
    map.fitBounds(bounds);
}

/* TODO: Step 4C: Show place details in an info window */
// Builds an InfoWindow to display details above the marker
function showDetails(placeResult, marker, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
        let placeInfowindow = new google.maps.InfoWindow();
        let rating = "None";
        if (placeResult.rating) rating = placeResult.rating;
        placeInfowindow.setContent('<div><strong>' + placeResult.name +
            '</strong><br>' + 'Rating: ' + rating + '</div>');
        placeInfowindow.open(marker.map, marker);
        currentInfoWindow.close();
        currentInfoWindow = placeInfowindow;
        showPanel(placeResult);
    } else {
        console.log('showDetails failed: ' + status);
    }
}

/* TODO: Step 4D: Load place details in a sidebar */
// Displays place details in a sidebar
function showPanel(placeResult) {
    // If infoPane is already open, close it
    if (infoPane.classList.contains("open")) {
        infoPane.classList.remove("open");
    }

    // Clear the previous details
    while (infoPane.lastChild) {
        infoPane.removeChild(infoPane.lastChild);
    }

    /* TODO: Step 4E: Display a Place Photo with the Place Details */
    // Add the primary photo, if there is one
    if (placeResult.photos) {
        let firstPhoto = placeResult.photos[0];
        let photo = document.createElement('img');
        photo.classList.add('hero');
        photo.src = firstPhoto.getUrl();
        infoPane.appendChild(photo);
    }

    // Add place details with text formatting
    let name = document.createElement('h1');
    name.classList.add('place');
    name.textContent = placeResult.name;
    infoPane.appendChild(name);
    if (placeResult.rating) {
        let rating = document.createElement('p');
        rating.classList.add('details');
        rating.textContent = `Rating: ${placeResult.rating} \u272e`;
        infoPane.appendChild(rating);
    }
    let address = document.createElement('p');
    address.classList.add('details');
    address.textContent = placeResult.formatted_address;
    infoPane.appendChild(address);
    if (placeResult.website) {
        let websitePara = document.createElement('p');
        let websiteLink = document.createElement('a');
        let websiteUrl = document.createTextNode(placeResult.website);
        websiteLink.appendChild(websiteUrl);
        websiteLink.title = placeResult.website;
        websiteLink.href = placeResult.website;
        websitePara.appendChild(websiteLink);
        infoPane.appendChild(websitePara);
    }

    // Open the infoPane
    infoPane.classList.add("open");
}


