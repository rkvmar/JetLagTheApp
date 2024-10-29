// Initialize the map centered on the world
const map = L.map('map').setView([20, 0], 2);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);
// Get user's current location and zoom to it
if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(function(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        map.setView([lat, lon], 13); // Zoom level 13 provides good city-level detail
    }, function(error) {
        console.error("Error getting location:", error);
    });
} else {
    console.log("Geolocation is not supported by this browser.");
}
// Watch user's position and update marker location
let userMarker = null;
navigator.geolocation.watchPosition(function(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    
    if (userMarker === null) {
        // Create marker if it doesn't exist
        userMarker = L.marker([lat, lon]).addTo(map)
            .bindPopup('You are here')
            .openPopup();
    } else {
        // Update existing marker position
        userMarker.setLatLng([lat, lon]);
    }
}, function(error) {
    console.error("Error watching location:", error);
}, {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 27000
});

// Add accuracy circle around user location
let accuracyCircle = null;
navigator.geolocation.watchPosition(function(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    if (accuracyCircle === null) {
        // Create accuracy circle if it doesn't exist
        accuracyCircle = L.circle([lat, lon], {
            radius: accuracy,
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(map);
    } else {
        // Update existing circle position and radius
        accuracyCircle.setLatLng([lat, lon]);
        accuracyCircle.setRadius(accuracy);
    }
}, function(error) {
    console.error("Error watching location:", error);
}, {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 27000
});
// Add direction indicator when device orientation is available
let directionMarker = null;
if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', function(event) {
        // Only proceed if we have user location and valid orientation data
        if (userMarker && event.alpha !== null) {
            const heading = event.alpha; // Degrees clockwise from north
            
            if (directionMarker === null) {
                // Create a small line marker to show direction
                directionMarker = L.polyline([[0,0], [0,0]], {
                    color: '#ff3333',
                    weight: 3
                }).addTo(map);
            }

            // Get current position from userMarker
            const pos = userMarker.getLatLng();
            
            // Calculate end point for direction line (30 meters in facing direction)
            const rad = (heading * Math.PI) / 180;
            const lat2 = pos.lat + (0.0003 * Math.cos(rad));
            const lng2 = pos.lng + (0.0003 * Math.sin(rad));
            
            // Update direction line
            directionMarker.setLatLngs([
                [pos.lat, pos.lng],
                [lat2, lng2]
            ]);
        }
    });
} else {
    console.log("Device orientation not supported");
}
