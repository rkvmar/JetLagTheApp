async function vetoChallenge() {
    try {
        console.log('Attempting to veto challenge for user:', currentUsername);
        console.log('Server URL:', serverURL);
        
        const response = await fetch(`${serverURL}/veto-challenge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: currentUsername })
        });

        console.log('Veto response status:', response.status);
        console.log('Veto response headers:', [...response.headers]);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Veto response data:', data);
        
        if (data.success) {
            challengeData = null;
            updateChallengeIcon(true);
            setInterval(checkVetoTimer, 1000);
            document.getElementById('challenge').classList.add('veto-active');
            challengeTextElement.textContent = '5:00';
            if (challengeOverlay) {
                closeChallenge();
            }
        }
    } catch (error) {
        console.error('Error vetoing challenge:', error);
        console.error('Error details:', error.message);
        alert('Failed to veto challenge. Please try again.');
    }
}


// Initialize the map centered on the world
const map = L.map('map', {
    zoomControl: false,      // Removes zoom buttons
    attributionControl: false // Removes attribution text
}).setView([20, 0], 2);
const serverURL = 'http://localhost:3000';
// Add global variables
let coins = 254;
let coinsElement = document.getElementById('coincount');
let currentUsername = null;
let userMarker = null;
let accuracyCircle = null;
// let challengeData = {
//     title: 'Challenge Title',
//     description: 'Challenge Description',
//     reward: 100
// }
let challengeData = null;
let otherUserMarkers = {};
let otherUserAccuracyCircles = {};
let vetoTimeout = null;
let vetoEndTime = null;
let userMenu = null;
const otherUsers = new Map(); // Store user data

// Replace the vetoEndTime variable with a function to check server
async function checkVetoTimer() {
    try {
        const response = await fetch(`${serverURL}/check-veto?username=${currentUsername}`);
        const data = await response.json();
        
        if (data.success && data.vetoActive) {
            const timeLeft = data.vetoEndTime - Date.now();
            if (timeLeft > 0) {
                const minutes = Math.floor(timeLeft / 60000);
                const seconds = Math.floor((timeLeft % 60000) / 1000);
                const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                challengeTextElement.textContent = timeString;
                document.getElementById('challenge').classList.add('veto-active');
                
                // Update the timer on the card if it's open
                const vetoTimer = challengeOverlay?.querySelector('.veto-timer');
                if (vetoTimer) {
                    vetoTimer.textContent = timeString;
                }
            }
        } else {
            document.getElementById('challenge').classList.remove('veto-active');
            if (!challengeData) {
                challengeTextElement.textContent = 'No Challenge';
            }
        }
    } catch (error) {
        console.error('Error checking veto timer:', error);
    }
}

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
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
navigator.geolocation.watchPosition(async function(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Update user marker
    if (userMarker === null) {
        userMarker = L.marker([lat, lng]).addTo(map);
        // Only set view when first creating the marker (initial load)
        map.setView([lat, lng], 18);
    } else {
        userMarker.setLatLng([lat, lng]);
    }

    // Update accuracy circle
    if (accuracyCircle === null) {
        accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(map);
    } else {
        accuracyCircle.setLatLng([lat, lng]);
        accuracyCircle.setRadius(accuracy);
    }

    // Send position to server if user is logged in
    if (currentUsername) {
        try {
            await fetch(`${serverURL}/update-position`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: currentUsername,
                    position: {
                        lat,
                        lng,
                        accuracy,
                        timestamp: new Date().toISOString()
                    }
                })
            });
        } catch (error) {
            console.error('Error updating position:', error);
        }
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
    const coinsContainer = document.getElementById('coins');
    const svgWidth = 50; // Width of the SVG icon in pixels
    const textWidth = coinsElement.getBoundingClientRect().width;
    coinsContainer.style.width = `${textWidth}px`;
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

challenge.addEventListener('click', async function() {
    if (!challengeExpanded) {
        // Check veto status before showing challenge
        const response = await fetch(`${serverURL}/check-veto?username=${currentUsername}`);
        const data = await response.json();
        
        let overlayContent;
        if (data.success && data.vetoActive) {
            const timeLeft = data.vetoEndTime - Date.now();
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            overlayContent = `
                <div class="challenge-content">
                    <div class="card-front">
                        <h1>Veto Active</h1>
                        <p class="challenge-description">You must wait before getting a new challenge.</p>
                        <div class="veto-timer">${timeString}</div>
                    </div>
                    <div class="card-back">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                            <path d="M24 0C10.7 0 0 10.7 0 24S10.7 48 24 48l8 0 0 19c0 40.3 16 79 44.5 107.5L158.1 256 76.5 337.5C48 366 32 404.7 32 445l0 19-8 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l336 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-8 0 0-19c0-40.3-16-79-44.5-107.5L225.9 256l81.5-81.5C336 146 352 107.3 352 67l0-19 8 0c13.3 0 24-10.7 24-24s-10.7-24-24-24L24 0zM192 289.9l81.5 81.5C293 391 304 417.4 304 445l0 19L80 464l0-19c0-27.6 11-54 30.5-73.5L192 289.9zm0-67.9l-81.5-81.5C91 121 80 94.6 80 67l0-19 224 0 0 19c0 27.6-11 54-30.5 73.5L192 222.1z"/>
                        </svg>
                    </div>
                </div>
            `;
        } else {
            overlayContent = `
                <div class="challenge-content">
                    <div class="card-front">
                        <h1>${challengeData ? challengeData.title : 'No Active Challenge'}</h1>
                        <p class="challenge-description">${challengeData ? challengeData.description : 'You are currently not doing a challenge.'}</p>
                        ${challengeData ? 
                            `<button id="veto-challenge" class="veto-challenge-button">Veto Challenge</button>` : 
                            `<button id="spin-challenge" class="spin-challenge-button">Pull New Challenge</button>`
                        }
                    </div>
                    <div class="card-back">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                            <path d="M192 93.7C192 59.5 221 0 256 0c36 0 64 59.5 64 93.7l0 66.3L497.8 278.5c8.9 5.9 14.2 15.9 14.2 26.6l0 56.7c0 10.9-10.7 18.6-21.1 15.2L320 320l0 80 57.6 43.2c4 3 6.4 7.8 6.4 12.8l0 42c0 7.8-6.3 14-14 14c-1.3 0-2.6-.2-3.9-.5L256 480 145.9 511.5c-1.3 .4-2.6 .5-3.9 .5c-7.8 0-14-6.3-14-14l0-42c0-5 2.4-9.8 6.4-12.8L192 400l0-80L21.1 377C10.7 380.4 0 372.7 0 361.8l0-56.7c0-10.7 5.3-20.7 14.2-26.6L192 160l0-66.3z"/>
                        </svg>
                    </div>
                </div>
            `;
        }
        
        challengeOverlay.innerHTML = overlayContent;
        challenge.classList.add('challenge-minimized');
        document.body.appendChild(darkOverlay);
        document.body.appendChild(challengeOverlay);
        challengeExpanded = true;
        
        // Add event listeners for buttons
        const spinButton = challengeOverlay.querySelector('#spin-challenge');
        const vetoButton = challengeOverlay.querySelector('#veto-challenge');
        if (spinButton) spinButton.addEventListener('click', spinChallenge);
        if (vetoButton) vetoButton.addEventListener('click', vetoChallenge);
    } else {
        closeChallenge();
    }
});

// Create and setup challenge overlay content
challengeOverlay.innerHTML = `
    <div class="challenge-content">
        <div class="card-front">
            <h1>No Active Challenge</h1>
            <p class="challenge-description">You are currently not doing a challenge.</p>
            <button id="spin-challenge" class="spin-challenge-button">Pull New Challenge</button>
        </div>
        <div class="card-back">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path d="M192 93.7C192 59.5 221 0 256 0c36 0 64 59.5 64 93.7l0 66.3L497.8 278.5c8.9 5.9 14.2 15.9 14.2 26.6l0 56.7c0 10.9-10.7 18.6-21.1 15.2L320 320l0 80 57.6 43.2c4 3 6.4 7.8 6.4 12.8l0 42c0 7.8-6.3 14-14 14c-1.3 0-2.6-.2-3.9-.5L256 480 145.9 511.5c-1.3 .4-2.6 .5-3.9 .5c-7.8 0-14-6.3-14-14l0-42c0-5 2.4-9.8 6.4-12.8L192 400l0-80L21.1 377C10.7 380.4 0 372.7 0 361.8l0-56.7c0-10.7 5.3-20.7 14.2-26.6L192 160l0-66.3z"/>
            </svg>
        </div>
    </div>
`;

// Add event listener for spin button if it exists
if (!challengeData) {
    const spinButton = challengeOverlay.querySelector('#spin-challenge');
    spinButton.addEventListener('click', async () => {
        const challengeContent = challengeOverlay.querySelector('.challenge-content');
        
        // First flip to back
        challengeContent.classList.add('flipping');
        
        try {
            const response = await fetch(`http://localhost:3000/get-challenge?username=${currentUsername}`);
            const data = await response.json();
            
            if (data.success && data.challenge) {
                // Rest of the code remains the same
                setTimeout(() => {
                    challengeData = data.challenge;
                    challengeTextElement.textContent = challengeData.title;
                    updateChallengeIcon(false);
                    
                    // Update card front content...
                    const cardFront = challengeContent.querySelector('.card-front');
                    cardFront.innerHTML = `
                        <h1>${data.challenge.title}</h1>
                        <p class="challenge-description">${data.challenge.description}</p>
                        <div class="challenge-buttons">
                            <button class="challenge-button complete-button" onclick="completeChallenge()">Complete</button>
                            <button class="challenge-button veto-button" onclick="vetoChallenge()">Veto</button>
                        </div>
                        <div class="challenge-reward">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="height: 30px; width: 30px; fill: white;">
                                <path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80zM160.7 161.1c10.2-.7 20.7-1.1 31.3-1.1c62.2 0 117.4 12.3 152.5 31.4C369.3 204.9 384 221.7 384 240c0 4-.7 7.9-2.1 11.7c-4.6 13.2-17 25.3-35 35.5c0 0 0 0 0 0c-.1 .1-.3 .1-.4 .2c0 0 0 0 0 0s0 0 0 0c-.3 .2-.6 .3-.9 .5c-35 19.4-90.8 32-153.6 32c-59.6 0-112.9-11.3-148.2-29.1c-1.9-.9-3.7-1.9-5.5-2.9C14.3 274.6 0 258 0 240c0-34.8 53.4-64.5 128-75.4c10.5-1.5 21.4-2.7 32.7-3.5zM416 240c0-21.9-10.6-39.9-24.1-53.4c28.3-4.4 54.2-11.4 76.2-20.5c16.3-6.8 31.5-15.2 43.9-25.5l0 35.4c0 19.3-16.5 37.1-43.8 50.9c-14.6 7.4-32.4 13.7-52.4 18.5c.1-1.8 .2-3.5 .2-5.3zm-32 96c0 18-14.3 34.6-38.4 48c-1.8 1-3.6 1.9-5.5 2.9C304.9 404.7 251.6 416 192 416c-62.8 0-118.6-12.6-153.6-32C14.3 370.6 0 354 0 336l0-35.4c12.5 10.3 27.6 18.7 43.9 25.5C83.4 342.6 135.8 352 192 352s108.6-9.4 148.1-25.9c7.8-3.2 15.3-6.9 22.4-10.9c6.1-3.4 11.8-7.2 17.2-11.2c1.5-1.1 2.9-2.3 4.3-3.4l0 3.4 0 5.7 0 26.3z"/>
                            </svg>
                            <span>${data.challenge.reward}</span>
                        </div>
                    `;
                    
                    setTimeout(() => {
                        challengeContent.classList.remove('flipping');
                    }, 50);
                }, 1500);
            }
        } catch (error) {
            console.error('Error getting new challenge:', error);
        }
    });
}

// Update challenge box text
const challengeTextElement = document.getElementById('challengetext');
challengeTextElement.textContent = challengeData ? challengeData.title : 'No Challenge';

// Update the signin handler to store username
document.getElementById('signin-button').addEventListener('click', async function() {
    const username = document.getElementById('username').value;
    
    if (username.trim()) {
        try {
            const response = await fetch('http://localhost:3000/check-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username.trim() })
            });
            const data = await response.json();
            
            if (data.exists) {
                currentUsername = username.trim(); // Store username
                coins = data.coins;
                updateCoins();
                
                document.getElementById('signin-overlay').style.display = 'none';
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
                await checkInitialVetoStatus();
            } else {
                alert('User not found!');
            }
        } catch (error) {
            console.error('Error checking username:', error);
            alert('Error checking username. Please try again.');
        }
    }
});

// Modify your existing updateOtherUsers function to update the otherUsers Map
async function updateOtherUsers() {
    if (!currentUsername) return;
    
    try {
        const response = await fetch(`${serverURL}/data`);
        const users = await response.json();
        
        // Remove markers for users who are no longer present
        for (let username in otherUserMarkers) {
            if (!users.find(u => u.username === username)) {  // Removed loggedIn check
                map.removeLayer(otherUserMarkers[username]);
                if (otherUserAccuracyCircles[username]) {
                    map.removeLayer(otherUserAccuracyCircles[username]);
                }
                delete otherUserMarkers[username];
                delete otherUserAccuracyCircles[username];
            }
        }
        
        // Update markers for all users
        users.forEach(user => {
            if (user.username !== currentUsername && user.position) {  // Removed loggedIn check
                const pos = [user.position.lat, user.position.lng];
                // ... rest of marker update logic ...
            }
        });
    } catch (error) {
        console.error('Error updating other users:', error);
    }
}

setInterval(updateOtherUsers, 1000);

// Add these functions to handle the button clicks
async function completeChallenge() {
    if (challengeData && currentUsername) {
        try {
            // First clear the challenge
            const clearResponse = await fetch('http://localhost:3000/clear-challenge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: currentUsername })
            });

            if (!clearResponse.ok) throw new Error('Failed to clear challenge');

            // Then update coins
            coins += challengeData.reward;
            const coinResponse = await fetch('http://localhost:3000/update-coins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: currentUsername,
                    coins: coins
                })
            });
            
            const data = await coinResponse.json();
            if (data.success) {
                // Update local coins display
                updateCoins();
                
                // Reset challenge
                challengeData = null;
                challengeTextElement.textContent = 'No Challenge';
                
                // Update the card content to show "No Active Challenge"
                const cardFront = challengeOverlay.querySelector('.card-front');
                cardFront.innerHTML = `
                    <h1>No Active Challenge</h1>
                    <p class="challenge-description">You are currently not doing a challenge.</p>
                    <button id="spin-challenge" class="spin-challenge-button">Pull New Challenge</button>
                `;
                
                // Re-add event listener for spin button
                const spinButton = cardFront.querySelector('#spin-challenge');
                spinButton.addEventListener('click', spinChallenge);
                
                // Close the challenge overlay
                closeChallenge();
            } else {
                console.error('Failed to update coins on server');
            }
        } catch (error) {
            console.error('Error completing challenge:', error);
        }
    }
}

// Modify vetoChallenge function
async function vetoChallenge() {
    try {
        const response = await fetch(`${serverURL}/veto-challenge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: currentUsername })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            challengeData = null;
            updateChallengeIcon(true);
            setInterval(checkVetoTimer, 1000);
            document.getElementById('challenge').classList.add('veto-active');
            challengeTextElement.textContent = '5:00';
            if (challengeOverlay) {
                closeChallenge();
            }
        }
    } catch (error) {
        console.error('Error vetoing challenge:', error);
        alert('Failed to veto challenge. Please try again.');
    }
}

// Modify spinChallenge to check veto status first
async function spinChallenge() {
    try {
        const response = await fetch(`${serverURL}/check-veto?username=${currentUsername}`);
        const data = await response.json();
        
        if (data.success && data.vetoActive) {
            const timeLeft = data.vetoEndTime - Date.now();
            if (timeLeft > 0) {
                const minutes = Math.floor(timeLeft / 60000);
                const seconds = Math.floor((timeLeft % 60000) / 1000);
                alert(`Please wait ${minutes}:${seconds.toString().padStart(2, '0')} before pulling a new challenge`);
                return;
            }
        }
        
        // Continue with existing spinChallenge logic
        const challengeContent = challengeOverlay.querySelector('.challenge-content');
        challengeContent.classList.add('flipping');
        
        try {
            const response = await fetch(`http://localhost:3000/get-challenge?username=${currentUsername}`);
            const data = await response.json();
            
            if (data.success && data.challenge) {
                setTimeout(() => {
                    challengeData = data.challenge;
                    challengeTextElement.textContent = challengeData.title;
                    
                    // Update the card front content
                    const cardFront = challengeContent.querySelector('.card-front');
                    cardFront.innerHTML = `
                        <h1>${challengeData.title}</h1>
                        <p class="challenge-description">${challengeData.description}</p>
                        <div class="challenge-buttons">
                            <button class="challenge-button complete-button" onclick="completeChallenge()">Complete</button>
                            <button class="challenge-button veto-button" onclick="vetoChallenge()">Veto</button>
                        </div>
                        <div class="challenge-reward">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="height: 30px; width: 30px; fill: white;">
                                <path d="M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .2-24.5 .6l-1.1-.6C142.3 114.6 128 98 128 80c0-44.2 86-80 192-80S512 35.8 512 80zM160.7 161.1c10.2-.7 20.7-1.1 31.3-1.1c62.2 0 117.4 12.3 152.5 31.4C369.3 204.9 384 221.7 384 240c0 4-.7 7.9-2.1 11.7c-4.6 13.2-17 25.3-35 35.5c0 0 0 0 0 0c-.1 .1-.3 .1-.4 .2c0 0 0 0 0 0s0 0 0 0c-.3 .2-.6 .3-.9 .5c-35 19.4-90.8 32-153.6 32c-59.6 0-112.9-11.3-148.2-29.1c-1.9-.9-3.7-1.9-5.5-2.9C14.3 274.6 0 258 0 240c0-34.8 53.4-64.5 128-75.4c10.5-1.5 21.4-2.7 32.7-3.5zM416 240c0-21.9-10.6-39.9-24.1-53.4c28.3-4.4 54.2-11.4 76.2-20.5c16.3-6.8 31.5-15.2 43.9-25.5l0 35.4c0 19.3-16.5 37.1-43.8 50.9c-14.6 7.4-32.4 13.7-52.4 18.5c.1-1.8 .2-3.5 .2-5.3zm-32 96c0 18-14.3 34.6-38.4 48c-1.8 1-3.6 1.9-5.5 2.9C304.9 404.7 251.6 416 192 416c-62.8 0-118.6-12.6-153.6-32C14.3 370.6 0 354 0 336l0-35.4c12.5 10.3 27.6 18.7 43.9 25.5C83.4 342.6 135.8 352 192 352s108.6-9.4 148.1-25.9c7.8-3.2 15.3-6.9 22.4-10.9c6.1-3.4 11.8-7.2 17.2-11.2c1.5-1.1 2.9-2.3 4.3-3.4l0 3.4 0 5.7 0 26.3z"/>
                            </svg>
                            <span>${challengeData.reward}</span>
                        </div>
                    `;
                    
                    // Flip back to front after a longer delay
                    setTimeout(() => {
                        challengeContent.classList.remove('flipping');
                    }, 50);
                }, 1500);
            }
        } catch (error) {
            console.error('Error getting new challenge:', error);
        }
    } catch (error) {
        console.error('Error in spinChallenge:', error);
    }
}

// Update the challenge icon based on state
function updateChallengeIcon(isVeto = false) {
    const challengeIcon = document.querySelector('#challenge-icon svg path');
    if (!challengeIcon) return;

    if (isVeto) {
        challengeIcon.setAttribute('d', 'M24 0C10.7 0 0 10.7 0 24S10.7 48 24 48l8 0 0 19c0 40.3 16 79 44.5 107.5L158.1 256 76.5 337.5C48 366 32 404.7 32 445l0 19-8 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l336 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-8 0 0-19c0-40.3-16-79-44.5-107.5L225.9 256l81.5-81.5C336 146 352 107.3 352 67l0-19 8 0c13.3 0 24-10.7 24-24s-10.7-24-24-24L24 0zM192 289.9l81.5 81.5C293 391 304 417.4 304 445l0 19L80 464l0-19c0-27.6 11-54 30.5-73.5L192 289.9zm0-67.9l-81.5-81.5C91 121 80 94.6 80 67l0-19 224 0 0 19c0 27.6-11 54-30.5 73.5L192 222.1z');
        challengeIcon.parentElement.setAttribute('viewBox', '0 0 384 512');
    } else {
        challengeIcon.setAttribute('d', 'M192 93.7C192 59.5 221 0 256 0c36 0 64 59.5 64 93.7l0 66.3L497.8 278.5c8.9 5.9 14.2 15.9 14.2 26.6l0 56.7c0 10.9-10.7 18.6-21.1 15.2L320 320l0 80 57.6 43.2c4 3 6.4 7.8 6.4 12.8l0 42c0 7.8-6.3 14-14 14c-1.3 0-2.6-.2-3.9-.5L256 480 145.9 511.5c-1.3 .4-2.6 .5-3.9 .5c-7.8 0-14-6.3-14-14l0-42c0-5 2.4-9.8 6.4-12.8L192 400l0-80L21.1 377C10.7 380.4 0 372.7 0 361.8l0-56.7c0-10.7 5.3-20.7 14.2-26.6L192 160l0-66.3z');
        challengeIcon.parentElement.setAttribute('viewBox', '0 0 512 512');
    }
}

// Add this function to check initial veto status
async function checkInitialVetoStatus() {
    if (!currentUsername) return;
    
    try {
        const response = await fetch(`${serverURL}/check-veto?username=${currentUsername}`);
        const data = await response.json();
        
        if (data.success && data.vetoActive) {
            challengeData = null;
            updateChallengeIcon(true);
            setInterval(checkVetoTimer, 1000);
            document.getElementById('challenge').classList.add('veto-active');
            const timeLeft = data.vetoEndTime - Date.now();
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            challengeTextElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    } catch (error) {
        console.error('Error checking initial veto status:', error);
    }
}

// Add heartbeat function
async function sendHeartbeat() {
    if (!currentUsername) return;
    
    try {
        await fetch(`${serverURL}/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: currentUsername })
        });
    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
}

// Start heartbeat when user signs in
async function handleSignIn() {
    const usernameInput = document.getElementById('username');
    const username = usernameInput.value.trim();
    
    if (username) {
        try {
            const response = await fetch(`${serverURL}/check-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });
            
            const data = await response.json();
            
            if (data.exists) {
                currentUsername = username;
                coins = data.coins;
                updateCoins();
                document.getElementById('signin-overlay').style.display = 'none';
                
                // Start heartbeat interval when user signs in
                setInterval(sendHeartbeat, 1000);
                
                // ... rest of sign in logic ...
            } else {
                alert('User not found');
            }
        } catch (error) {
            console.error('Error checking user:', error);
            alert('Error signing in. Please try again.');
        }
    }
}

// Update the updateOtherUsers function to handle logged-in status
async function updateOtherUsers() {
    if (!currentUsername) return;
    
    try {
        const response = await fetch(`${serverURL}/data`);
        const users = await response.json();
        
        // Remove markers for users who are no longer active
        for (let username in otherUserMarkers) {
            if (!users.find(u => u.username === username && u.loggedIn)) {
                map.removeLayer(otherUserMarkers[username]);
                if (otherUserAccuracyCircles[username]) {
                    map.removeLayer(otherUserAccuracyCircles[username]);
                }
                delete otherUserMarkers[username];
                delete otherUserAccuracyCircles[username];
            }
        }
        
        // Update markers only for logged-in users
        users.forEach(user => {
            if (user.username !== currentUsername && user.loggedIn && user.position) {
                const pos = [user.position.lat, user.position.lng];
                
                // ... rest of marker update logic ...
            }
        });
    } catch (error) {
        console.error('Error updating other users:', error);
    }
}

// Add these variables at the top of your script
let heartbeatInterval = null;

// Modify the handleSignIn function
async function handleSignIn() {
    const usernameInput = document.getElementById('username');
    const username = usernameInput.value.trim();
    
    if (username) {
        try {
            const response = await fetch(`${serverURL}/check-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });
            
            const data = await response.json();
            
            if (data.exists) {
                currentUsername = username;
                coins = data.coins;
                updateCoins();
                document.getElementById('signin-overlay').style.display = 'none';
                
                // Start heartbeat
                startHeartbeat();
                
                // Start updating other users
                setInterval(updateOtherUsers, 1000);
            } else {
                alert('User not found');
            }
        } catch (error) {
            console.error('Error checking user:', error);
            alert('Error signing in. Please try again.');
        }
    }
}

// Add heartbeat functions
function startHeartbeat() {
    // Clear any existing interval
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    // Send immediate heartbeat
    sendHeartbeat();
    
    // Set up regular heartbeat
    heartbeatInterval = setInterval(sendHeartbeat, 1000);
}

async function sendHeartbeat() {
    if (!currentUsername) return;
    
    try {
        const response = await fetch(`${serverURL}/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: currentUsername })
        });
        
        if (!response.ok) {
            console.error('Heartbeat failed:', await response.text());
        }
    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
}

// Add cleanup on window unload
window.addEventListener('beforeunload', async () => {
    if (currentUsername) {
        try {
            // Clear heartbeat interval
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
            
            // Optionally, send one final request to mark user as logged out
            await fetch(`${serverURL}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: currentUsername })
            });
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
});

// Replace the default marker with a circular marker
function createUserMarker(position) {
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    // Create a circular marker with a pulsing effect
    userMarker = L.circleMarker(position, {
        radius: 8,
        fillColor: '#007AFF', // iOS blue color
        fillOpacity: 1,
        color: 'white',
        weight: 2,
        className: 'pulse-marker'
    }).addTo(map);
}

// Add this CSS to create the pulsing effect
const style = document.createElement('style');
style.textContent = `
    .pulse-marker {
        animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
        0% {
            opacity: 1;
            transform: scale(1);
        }
        70% {
            opacity: 0.25;
            transform: scale(2.5);
        }
        100% {
            opacity: 0;
            transform: scale(3);
        }
    }
    .leaflet-marker-icon {
        background: none !important;
        border: none !important;
    }
`;
document.head.appendChild(style);

// Update the updatePosition function to use the new marker style
function updatePosition(position) {
    const pos = [position.coords.latitude, position.coords.longitude];
    
    if (!userMarker) {
        createUserMarker(pos);
    } else {
        userMarker.setLatLng(pos);
    }
    
    // Update accuracy circle
    if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
    }
    
    accuracyCircle = L.circle(pos, {
        radius: position.coords.accuracy / 2,
        fillColor: '#007AFF',
        fillOpacity: 0.15,
        color: '#007AFF',
        weight: 0
    }).addTo(map);
}

// Update shop functionality
function createShopMenu() {
    console.log('Creating shop menu');
    const shopOverlay = document.createElement('div');
    shopOverlay.id = 'shop-overlay';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'shop-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Shop';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'close-shop';
    closeButton.textContent = '×';
    closeButton.onclick = () => {
        closeShop();
    };
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create content
    const content = document.createElement('div');
    content.className = 'shop-items';
    
    // Add shop items with correct SVG icons
    const items = [
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M86.8 48c-12.2 0-23.6 5.5-31.2 15L42.7 79C34.5 89.3 19.4 91 9 82.7S-3 59.4 5.3 49L18 33C34.7 12.2 60 0 86.8 0L361.2 0c26.7 0 52 12.2 68.7 33l12.8 16c8.3 10.4 6.6 25.5-3.8 33.7s-25.5 6.6-33.7-3.7L392.5 63c-7.6-9.5-19.1-15-31.2-15L248 48l0 48 40 0c53 0 96 43 96 96l0 160c0 30.6-14.3 57.8-36.6 75.4l65.5 65.5c7.1 7.1 2.1 19.1-7.9 19.1l-39.7 0c-8.5 0-16.6-3.4-22.6-9.4L288 448l-128 0-54.6 54.6c-6 6-14.1 9.4-22.6 9.4L43 512c-10 0-15-12.1-7.9-19.1l65.5-65.5C78.3 409.8 64 382.6 64 352l0-160c0-53 43-96 96-96l40 0 0-48L86.8 48zM160 160c-17.7 0-32 14.3-32 32l0 32c0 17.7 14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-32c0-17.7-14.3-32-32-32l-128 0zm32 192a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 32a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>`, 
            title: 'Low-Speed Rail', 
            price: '10 coins/min' 
        },
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M96 0C43 0 0 43 0 96L0 352c0 48 35.2 87.7 81.1 94.9l-46 46C28.1 499.9 33.1 512 43 512l39.7 0c8.5 0 16.6-3.4 22.6-9.4L160 448l128 0 54.6 54.6c6 6 14.1 9.4 22.6 9.4l39.7 0c10 0 15-12.1 7.9-19.1l-46-46c46-7.1 81.1-46.9 81.1-94.9l0-256c0-53-43-96-96-96L96 0zM64 96c0-17.7 14.3-32 32-32l256 0c17.7 0 32 14.3 32 32l0 96c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-96zM224 288a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/></svg>`, 
            title: 'High-Speed Rail', 
            price: '25 coins/min' 
        },
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M288 0C422.4 0 512 35.2 512 80l0 16 0 32c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32l0 160c0 17.7-14.3 32-32 32l0 32c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-32-192 0 0 32c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-32c-17.7 0-32-14.3-32-32l0-160c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32c0 0 0 0 0 0l0-32s0 0 0 0l0-16C64 35.2 153.6 0 288 0zM128 160l0 96c0 17.7 14.3 32 32 32l112 0 0-160-112 0c-17.7 0-32 14.3-32 32zM304 288l112 0c17.7 0 32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-112 0 0 160zM144 400a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm288 0a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM384 80c0-8.8-7.2-16-16-16L208 64c-8.8 0-16 7.2-16 16s7.2 16 16 16l160 0c8.8 0 16-7.2 16-16z"/></svg>`, 
            title: 'Bus', 
            price: '5 coins/min' 
        },
        { 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M192 32c0-17.7 14.3-32 32-32L352 0c17.7 0 32 14.3 32 32l0 32 48 0c26.5 0 48 21.5 48 48l0 128 44.4 14.8c23.1 7.7 29.5 37.5 11.5 53.9l-101 92.6c-16.2 9.4-34.7 15.1-50.9 15.1c-19.6 0-40.8-7.7-59.2-20.3c-22.1-15.5-51.6-15.5-73.7 0c-17.1 11.8-38 20.3-59.2 20.3c-16.2 0-34.7-5.7-50.9-15.1l-101-92.6c-18-16.5-11.6-46.2 11.5-53.9L96 240l0-128c0-26.5 21.5-48 48-48l48 0 0-32zM160 218.7l107.8-35.9c13.1-4.4 27.3-4.4 40.5 0L416 218.7l0-90.7-256 0 0 90.7zM306.5 421.9C329 437.4 356.5 448 384 448c26.9 0 55.4-10.8 77.4-26.1c0 0 0 0 0 0c11.9-8.5 28.1-7.8 39.2 1.7c14.4 11.9 32.5 21 50.6 25.2c17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25C449.5 501.7 417 512 384 512c-31.9 0-60.6-9.9-80.4-18.9c-5.8-2.7-11.1-5.3-15.6-7.7c-4.5 2.4-9.7 5.1-15.6 7.7c-19.8 9-48.5 18.9-80.4 18.9c-33 0-65.5-10.3-94.5-25.8c-13.4 8.4-33.7 19.3-58.2 25c-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18.1-4.2 36.2-13.3 50.6-25.2c11.1-9.4 27.3-10.1 39.2-1.7c0 0 0 0 0 0C136.7 437.2 165.1 448 192 448c27.5 0 55-10.6 77.5-26.1c11.1-7.9 25.9-7.9 37 0z"/></svg>`, 
            title: 'Ferry', 
            price: '10 coins/min' 
        },
        {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/></svg>`,
            title: 'Double value & veto of next challenge', 
            price: '250 coins' 
        }
    ];

    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'shop-item';
        
        itemDiv.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-content">
                <h4 class="shop-item-title">${item.title}</h4>
                <p class="shop-item-description">${item.price}</p>
            </div>
        `;
        
        content.appendChild(itemDiv);
    });

    shopOverlay.appendChild(header);
    shopOverlay.appendChild(content);
    document.body.appendChild(shopOverlay);
    
    // Force a reflow before adding the visible class
    shopOverlay.offsetHeight;
    requestAnimationFrame(() => {
        shopOverlay.classList.add('visible');
    });
}

function openShop() {
    const shopOverlay = document.getElementById('shop-overlay');
    if (!shopOverlay) {
        createShopMenu();
        // Small delay to ensure DOM is ready
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.getElementById('shop-overlay').classList.add('visible');
                document.body.classList.add('shop-open');
            });
        });
    } else {
        shopOverlay.classList.add('visible');
        document.body.classList.add('shop-open');
    }
}

function closeShop() {
    const shopOverlay = document.getElementById('shop-overlay');
    shopOverlay.classList.remove('visible');
    document.body.classList.remove('shop-open');
    
    // Remove the element after animation completes
    shopOverlay.addEventListener('transitionend', function handler(e) {
        if (e.propertyName === 'transform') {
            shopOverlay.removeEventListener('transitionend', handler);
            if (!shopOverlay.classList.contains('visible')) {
                shopOverlay.remove();
            }
        }
    });
}

// Update click handler for coin button
document.addEventListener('DOMContentLoaded', () => {
    const coinButton = document.getElementById('coin-button');
    if (coinButton) {
        coinButton.addEventListener('click', openShop);
    }
});

