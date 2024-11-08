// Initialize the map centered on the world
const map = L.map('map', {
    zoomControl: false,      // Removes zoom buttons
    attributionControl: false // Removes attribution text
}).setView([20, 0], 2);

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

// Add function to update the veto timer display
function updateVetoTimer() {
    if (vetoEndTime) {
        const now = new Date().getTime();
        const timeLeft = vetoEndTime - now;
        
        if (timeLeft <= 0) {
            // Reset veto state
            vetoEndTime = null;
            clearInterval(vetoTimeout);
            vetoTimeout = null;
            challengeTextElement.textContent = 'No Challenge';
            document.getElementById('challenge').classList.remove('veto-active');
            
            // Reset challenge card
            const cardFront = challengeOverlay.querySelector('.card-front');
            cardFront.innerHTML = `
                <h1>No Active Challenge</h1>
                <p class="challenge-description">You are currently not doing a challenge.</p>
                <button id="spin-challenge" class="spin-challenge-button">Pull New Challenge</button>
            `;
            
            // Re-add event listener for spin button
            const spinButton = cardFront.querySelector('#spin-challenge');
            spinButton.addEventListener('click', spinChallenge);
            
            return;
        }
        
        // Calculate minutes and seconds
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update both displays
        challengeTextElement.textContent = timeString;
        
        // Update the timer on the card if it's open
        const vetoTimer = challengeOverlay.querySelector('.veto-timer');
        if (vetoTimer) {
            vetoTimer.textContent = timeString;
        }
    }
}

// Add OpenStreetMap tiles
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
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
navigator.geolocation.watchPosition(async function(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Update user marker
    if (userMarker === null) {
        userMarker = L.marker([lat, lon]).addTo(map);
        // Only set view when first creating the marker (initial load)
        map.setView([lat, lon], 18);
    } else {
        userMarker.setLatLng([lat, lon]);
    }

    // Update accuracy circle
    if (accuracyCircle === null) {
        accuracyCircle = L.circle([lat, lon], {
            radius: accuracy,
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(map);
    } else {
        accuracyCircle.setLatLng([lat, lon]);
        accuracyCircle.setRadius(accuracy);
    }

    // Send position to server if user is logged in
    if (currentUsername) {
        try {
            await fetch('http://localhost:3000/update-position', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: currentUsername,
                    position: {
                        lat,
                        lon,
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

challenge.addEventListener('click', function() {
    if (!challengeExpanded) {
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
            } else {
                alert('User not found!');
            }
        } catch (error) {
            console.error('Error checking username:', error);
            alert('Error checking username. Please try again.');
        }
    }
});

async function updateOtherUsers() {
    if (!currentUsername) return;
    
    try {
        const response = await fetch('http://localhost:3000/data');
        const users = await response.json();
        
        // Remove markers and circles for users who are no longer in the data
        for (let username in otherUserMarkers) {
            if (!users.find(u => u.username === username)) {
                map.removeLayer(otherUserMarkers[username]);
                if (otherUserAccuracyCircles[username]) {
                    map.removeLayer(otherUserAccuracyCircles[username]);
                }
                delete otherUserMarkers[username];
                delete otherUserAccuracyCircles[username];
            }
        }
        
        // Update or add markers for other users
        users.forEach(user => {
            if (user.username !== currentUsername && user.position) {
                const pos = [user.position.lat, user.position.lon];
                
                // Update or create marker
                if (otherUserMarkers[user.username]) {
                    otherUserMarkers[user.username].setLatLng(pos);
                } else {
                    otherUserMarkers[user.username] = L.circleMarker(pos, {
                        radius: 8,
                        fillColor: '#4CAF50',
                        color: '#45a049',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(map);
                    
                    otherUserMarkers[user.username].bindTooltip(user.username, {
                        permanent: true,
                        direction: 'top',
                        offset: [0, -10]
                    });
                }

                // Update or create accuracy circle
                if (otherUserAccuracyCircles[user.username]) {
                    otherUserAccuracyCircles[user.username].setLatLng(pos);
                    otherUserAccuracyCircles[user.username].setRadius(user.position.accuracy);
                } else {
                    otherUserAccuracyCircles[user.username] = L.circle(pos, {
                        radius: user.position.accuracy,
                        color: '#4CAF50',
                        fillColor: '#4CAF50',
                        fillOpacity: 0.1,
                        weight: 1
                    }).addTo(map);
                }
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
    if (challengeData && currentUsername) {
        try {
            const response = await fetch('http://localhost:3000/clear-challenge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: currentUsername })
            });

            if (response.ok) {
                challengeData = null;
                
                // Set veto timeout
                const VETO_DURATION = 5 * 60 * 1000;
                vetoEndTime = new Date().getTime() + VETO_DURATION;
                
                // Add veto styling and swap icon
                const challenge = document.getElementById('challenge');
                challenge.classList.add('veto-active');
                const challengeIcon = document.getElementById('challenge-icon');
                challengeIcon.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" style="height: 50px; max-width: 100%; fill: white; position: absolute; top: 50%; left:10px; transform: translateY(-50%);">
                        <path d="M24 0C10.7 0 0 10.7 0 24S10.7 48 24 48l8 0 0 19c0 40.3 16 79 44.5 107.5L158.1 256 76.5 337.5C48 366 32 404.7 32 445l0 19-8 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l336 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-8 0 0-19c0-40.3-16-79-44.5-107.5L225.9 256l81.5-81.5C336 146 352 107.3 352 67l0-19 8 0c13.3 0 24-10.7 24-24s-10.7-24-24-24L24 0zM192 289.9l81.5 81.5C293 391 304 417.4 304 445l0 19L80 464l0-19c0-27.6 11-54 30.5-73.5L192 289.9zm0-67.9l-81.5-81.5C91 121 80 94.6 80 67l0-19 224 0 0 19c0 27.6-11 54-30.5 73.5L192 222.1z"/>
                    </svg>
                `;
                
                // Update card to show countdown
                const cardFront = challengeOverlay.querySelector('.card-front');
                cardFront.innerHTML = `
                    <h1>Challenge Vetoed</h1>
                    <p class="challenge-description">You must wait before pulling another challenge.</p>
                    <div class="veto-timer">5:00</div>
                `;
                
                // Start countdown
                updateVetoTimer(); // Call immediately to show initial state
                vetoTimeout = setInterval(updateVetoTimer, 1000);
                
                // Close the challenge overlay
                closeChallenge();
            }
        } catch (error) {
            console.error('Error vetoing challenge:', error);
        }
    }
}

// Modify spinChallenge function to check for veto timeout
async function spinChallenge() {
    if (vetoEndTime) {
        const timeLeft = vetoEndTime - new Date().getTime();
        if (timeLeft > 0) {
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            alert(`Please wait ${minutes}:${seconds.toString().padStart(2, '0')} before pulling a new challenge`);
            return;
        }
    }
    
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
}

