// Initialize the map centered on the world
const map = L.map('map', {
    zoomControl: false,      // Removes zoom buttons
    attributionControl: false // Removes attribution text
}).setView([20, 0], 2);
let coins = 254;
let coinsElement = document.getElementById('coincount');
let challenge = ''

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
function updateChallenge() {
    const challengeElement = document.getElementById('challengetext');
    const challengeContainer = document.getElementById('challenge');
    
    // Only update if the text has changed
        const svgWidth = 70;
        const textWidth = challengeElement.getBoundingClientRect().width;
        if(challenge == ''){
            challengeContainer.style.width = '80px';
            challengeElement.textContent = '';
        }else{
        challengeContainer.style.width = `${svgWidth + textWidth + 30}px`;
        challengeElement.textContent = challenge.text;
        }
}

// Reduce update frequency to once per second
setInterval(updateChallenge, 100);

// Change from map-icon to map-button
document.getElementById('map-button').addEventListener('click', function() {
    if (userMarker) {
        const pos = userMarker.getLatLng();
        map.setView(pos, 18); // Reset to user's position with zoom level 18
    }
});

function changeCoins(newAmount) {
    if (newAmount > coins) {
        for (let i = coins; i < newAmount; i++) {   
            setTimeout(() => {
                coins++;
                updateCoins();
            }, i*4);
        }
    }
    else if (newAmount < coins) {
        for (let i = coins; i > newAmount; i--) {
            setTimeout(() => {
                coins--;
                updateCoins();
            }, i*4);
        }
    }
}
let challengeExpanded = false;

document.querySelector('#challenge svg').addEventListener('click', function(e) {
    e.stopPropagation();
    
    if (!challengeExpanded) {
        const challengeContainer = document.getElementById('challenge');
        const challengeText = document.getElementById('challengetext');
        
        // Slide off to the left
        challengeContainer.style.left = '-200px';
        challengeText.style.opacity = '0';

        // Save original attributes
        this.dataset.originalHeight = this.style.height;
        this.dataset.originalPosition = this.style.position;
        this.dataset.originalTop = this.style.top;
        this.dataset.originalLeft = this.style.left;
        this.dataset.originalTransform = this.style.transform;
        
        // Create overlay with fade in
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0)';
        overlay.style.zIndex = '1999';
        overlay.style.transition = 'background-color 0.3s ease';
        overlay.id = 'challenge-overlay';
        document.body.appendChild(overlay);
        
        // Force reflow
        overlay.offsetHeight;
        overlay.style.backgroundColor = 'rgba(0,0,0,0)';
        
        // Get initial position
        const rect = this.getBoundingClientRect();
        const initialTop = rect.top + 'px';
        const initialLeft = rect.left + 'px';
        const initialHeight = rect.height + 'px';
        
        // Set initial position and add transition
        this.style.position = 'fixed';
        this.style.top = initialTop;
        this.style.left = initialLeft;
        this.style.height = initialHeight;
        this.style.transition = 'all 0.3s ease';
        this.style.zIndex = '2004'; // Higher than overlay
        
        // Force reflow
        this.offsetHeight;
        
        // Animate to center
        this.style.height = '80%';
        this.style.top = '50%';
        this.style.left = '50%';
        this.style.transform = 'translate(-50%, -50%)';
        this.style.zIndex = '2004';
        
        challengeExpanded = true;
        
        // Add click event to overlay to close
        overlay.addEventListener('click', closeChallenge);
    }
});

function closeChallenge() {
    const hexagon = document.querySelector('#challenge svg');
    const overlay = document.getElementById('challenge-overlay');
    
    if (challengeExpanded && hexagon && overlay) {
        // Animate back
        hexagon.style.position = hexagon.dataset.originalPosition;
        hexagon.style.height = hexagon.dataset.originalHeight;
        hexagon.style.top = hexagon.dataset.originalTop;
        hexagon.style.left = hexagon.dataset.originalLeft;
        hexagon.style.transform = hexagon.dataset.originalTransform;
        
        // Fade out overlay
        overlay.style.backgroundColor = 'rgba(0,0,0,0)';
        
        // Bring back the challenge box immediately
        const challengeContainer = document.getElementById('challenge');
        const challengeText = document.getElementById('challengetext');
        
        // Slide the box back in
        challengeContainer.style.left = '15px';
        
        // After box slides in, show the text
        setTimeout(() => {
            challengeText.style.opacity = '1';
        }, 200);
        
        setTimeout(() => {
            hexagon.style.transition = '';
            hexagon.style.zIndex = 'auto';
            overlay.remove();
            challengeExpanded = false;
            
            if (challenge && challenge.text) {
                updateChallenge();
            }
        }, 300);
    }
}