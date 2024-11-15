const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const cors = require('cors');
const users = [{
    username: "marc", 
    coins: 10000, 
    position: null,
    activeChallenge: null,
    loggedIn: false,
    lastHeartbeat: null
}, {
    username: "henry", 
    coins: 100, 
    position: null,
    activeChallenge: null,
    loggedIn: false,
    lastHeartbeat: null
}];
const challenges = [{title: "Challenge 1", description: "Challenge 1 description", reward: 100}, {title: "Challenge 2", description: "Challenge 2 description", reward: 200}];
const fs = require('fs');
const vetoTimers = {}; // Store veto timers for each user

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve index.html as the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Check user endpoint
app.post('/check-user', (req, res) => {
    const { username } = req.body;
    console.log('Received username:', username);
    
    const user = users.find(user => 
        user.username.toLowerCase() === username.toLowerCase()
    );
    
    if (user) {
        user.loggedIn = true;
        user.lastHeartbeat = Date.now();
        console.log(`User ${username} logged in`);
        
        res.json({
            exists: true,
            coins: user.coins,
            activeChallenge: user.activeChallenge
        });
    } else {
        res.json({
            exists: false,
            coins: null,
            activeChallenge: null
        });
    }
});

// Add new endpoint for updating user position
app.post('/update-position', (req, res) => {
    const { username, position } = req.body;
    
    // Find user and update their position
    const user = users.find(user => 
        user.username.toLowerCase() === username.toLowerCase()
    );
    
    if (user) {
        user.position = position;
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'User not found' });
    }
});

// Add endpoint for getting a random challenge
app.get('/get-challenge', (req, res) => {
    const { username } = req.query;
    if (!username) {
        res.json({ success: false, error: 'Username required' });
        return;
    }

    const user = users.find(user => user.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        res.json({ success: false, error: 'User not found' });
        return;
    }

    if (challenges.length === 0) {
        res.json({ success: false, error: 'No challenges available' });
        return;
    }

    const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
    user.activeChallenge = randomChallenge;
    res.json({ success: true, challenge: randomChallenge });
});

// Add new endpoint for updating user coins
app.post('/update-coins', (req, res) => {
    const { username, coins } = req.body;
    
    // Find user and update their coins
    const user = users.find(user => 
        user.username.toLowerCase() === username.toLowerCase()
    );
    
    if (user) {
        user.coins = coins;
        res.json({ success: true, coins: user.coins });
    } else {
        res.json({ success: false, error: 'User not found' });
    }
});

// Add endpoint to clear challenge
app.post('/clear-challenge', (req, res) => {
    const { username } = req.body;
    
    const user = users.find(user => user.username.toLowerCase() === username.toLowerCase());
    if (user) {
        user.activeChallenge = null;
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'User not found' });
    }
});

// Modify the veto endpoint
app.post('/veto-challenge', (req, res) => {
    console.log('Received veto challenge request:', req.body); // Debug line
    
    const { username } = req.body;
    
    if (!username) {
        console.log('No username provided in veto request'); // Debug line
        return res.json({ success: false, error: 'Username required' });
    }
    
    const user = users.find(user => 
        user.username.toLowerCase() === username.toLowerCase()
    );
    
    console.log('Found user:', user); // Debug line
    
    if (user) {
        // Set veto end time (5 minutes from now)
        vetoTimers[username] = Date.now() + (5 * 60 * 1000);
        user.activeChallenge = null;
        
        console.log('Set veto timer for user:', username, vetoTimers[username]); // Debug line
        
        return res.json({ 
            success: true, 
            vetoEndTime: vetoTimers[username] 
        });
    } else {
        console.log('User not found for veto:', username); // Debug line
        return res.json({ 
            success: false, 
            error: 'User not found' 
        });
    }
});

// Add new endpoint to check veto timer
app.get('/check-veto', (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.json({ success: false, error: 'Username required' });
    }

    const vetoEndTime = vetoTimers[username];
    if (vetoEndTime && vetoEndTime > Date.now()) {
        res.json({ 
            success: true, 
            vetoActive: true, 
            vetoEndTime 
        });
    } else {
        // Clear expired veto timer
        if (vetoEndTime) {
            delete vetoTimers[username];
        }
        res.json({ 
            success: true, 
            vetoActive: false 
        });
    }
});

// Add heartbeat endpoint
app.post('/heartbeat', (req, res) => {
    const { username } = req.body;
    const user = users.find(user => user.username.toLowerCase() === username.toLowerCase());
    
    if (user) {
        user.loggedIn = true;
        user.lastHeartbeat = Date.now();
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'User not found' });
    }
});

// Comment out user tracking code
// function checkInactiveUsers() {
//     const inactivityThreshold = 5000;
//     const currentTime = Date.now();
    
//     users.forEach(user => {
//         if (user.loggedIn && (!user.lastHeartbeat || currentTime - user.lastHeartbeat > inactivityThreshold)) {
//             user.loggedIn = false;
//             user.position = null;
//             console.log(`User ${user.username} marked as inactive`);
//         }
//     });
// }

// Comment out the interval
// setInterval(checkInactiveUsers, 1000);

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
app.get('/data', (req, res) => {
    // const activeUsers = users.filter(user => user.loggedIn);  // Comment out filtering
    res.json(users);  // Return all users
});

// Comment out logout endpoint
// app.post('/logout', (req, res) => {
//     const { username } = req.body;
//     const user = users.find(user => user.username.toLowerCase() === username.toLowerCase());
    
//     if (user) {
//         user.loggedIn = false;
//         user.position = null;
//         user.lastHeartbeat = null;
//         console.log(`User ${username} logged out`);
//         res.json({ success: true });
//     } else {
//         res.json({ success: false, error: 'User not found' });
//     }
// });