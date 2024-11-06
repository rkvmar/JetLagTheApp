// Initialize the map centered on the world
const map = L.map('map', {
    zoomControl: false,      // Removes zoom buttons
    attributionControl: false // Removes attribution text
}).setView([20, 0], 2);
let coins = 254;
let coinsElement = document.getElementById('coincount');
let challengeData = {
    title: 'Challenge Title',
    description: 'Challenge Description',
    reward: 100
}

// Add OpenStreetMap tiles
L.tileLayer('     https://tile.thunderforest.com/transport-dark/{z}/{x}/{y}.png?apikey=6df58ced76544b5094599df7da009064', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);
// Get user's current location and zoom to it
if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(function(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        map.setView([lat, lon], 18); // Increased zoom level for better detail
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
    } else {
        // Update existing marker position
        userMarker.setLatLng([lat, lon]);
    }
    
    // Add this line to make the map follow the user
    map.panTo([lat, lon]);
    
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

function updateCoins() {
    const coinsElement = document.getElementById('coincount');
    const coinsContainer = document.getElementById('coins');
    const svgWidth = 50; // Width of the SVG icon in pixels
    const textWidth = coinsElement.getBoundingClientRect().width;
    coinsContainer.style.width = `${svgWidth + textWidth + 40}px`;
    coinsElement.textContent = coins.toString();
}
setInterval(updateCoins, 100);

// Add click handler for map button
document.getElementById('map-button').addEventListener('click', function() {
    if (userMarker) {
        const userPosition = userMarker.getLatLng();
        map.setView(userPosition, 18); // Zoom level 18 for good detail
    }
});

let challengeExpanded = false;
const challenge = document.getElementById('challenge');
const challengeOverlay = document.createElement('div');
challengeOverlay.id = 'challenge-overlay';
const darkOverlay = document.createElement('div');
darkOverlay.id = 'dark-overlay';

// Add click handler for dark overlay
darkOverlay.addEventListener('click', closeChallenge);

function closeChallenge() {
    challenge.classList.remove('challenge-minimized');
    challengeOverlay.remove();
    darkOverlay.remove();
    challengeExpanded = false;
}

challenge.addEventListener('click', function() {
    if (!challengeExpanded) {
        // Move challenge box to side and show overlays
        challenge.classList.add('challenge-minimized');
        document.body.appendChild(darkOverlay);
        document.body.appendChild(challengeOverlay);
        challengeExpanded = true;
    } else {
        closeChallenge();
    }
});

// Create and setup challenge overlay content
challengeOverlay.innerHTML = `
    <div class="challenge-content">
        <h1>${challengeData.title}</h1>
        <p class="challenge-description">${challengeData.description}</p>
        <div class="challenge-reward">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="height: 30px; width: 30px; fill: white;">
                <path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80zM160.7 161.1c10.2-.7 20.7-1.1 31.3-1.1c62.2 0 117.4 12.3 152.5 31.4C369.3 204.9 384 221.7 384 240c0 4-.7 7.9-2.1 11.7c-4.6 13.2-17 25.3-35 35.5c0 0 0 0 0 0c-.1 .1-.3 .1-.4 .2c0 0 0 0 0 0s0 0 0 0c-.3 .2-.6 .3-.9 .5c-35 19.4-90.8 32-153.6 32c-59.6 0-112.9-11.3-148.2-29.1c-1.9-.9-3.7-1.9-5.5-2.9C14.3 274.6 0 258 0 240c0-34.8 53.4-64.5 128-75.4c10.5-1.5 21.4-2.7 32.7-3.5zM416 240c0-21.9-10.6-39.9-24.1-53.4c28.3-4.4 54.2-11.4 76.2-20.5c16.3-6.8 31.5-15.2 43.9-25.5l0 35.4c0 19.3-16.5 37.1-43.8 50.9c-14.6 7.4-32.4 13.7-52.4 18.5c.1-1.8 .2-3.5 .2-5.3zm-32 96c0 18-14.3 34.6-38.4 48c-1.8 1-3.6 1.9-5.5 2.9C304.9 404.7 251.6 416 192 416c-62.8 0-118.6-12.6-153.6-32C14.3 370.6 0 354 0 336l0-35.4c12.5 10.3 27.6 18.7 43.9 25.5C83.4 342.6 135.8 352 192 352s108.6-9.4 148.1-25.9c7.8-3.2 15.3-6.9 22.4-10.9c6.1-3.4 11.8-7.2 17.2-11.2c1.5-1.1 2.9-2.3 4.3-3.4l0 3.4 0 5.7 0 26.3zm32 0l0-32 0-25.9c19-4.2 36.5-9.5 52.1-16c16.3-6.8 31.5-15.2 43.9-25.5l0 35.4c0 10.5-5 21-14.9 30.9c-16.3 16.3-45 29.7-81.3 38.4c.1-1.7 .2-3.5 .2-5.3zM192 448c56.2 0 108.6-9.4 148.1-25.9c16.3-6.8 31.5-15.2 43.9-25.5l0 35.4c0 44.2-86 80-192 80S0 476.2 0 432l0-35.4c12.5 10.3 27.6 18.7 43.9 25.5C83.4 438.6 135.8 448 192 448z"/>
            </svg>
            <span>${challengeData.reward}</span>
        </div>
    </div>
`;

// Update challenge box text
document.getElementById('challengetext').textContent = challengeData.title;