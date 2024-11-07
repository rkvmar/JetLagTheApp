const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const cors = require('cors');
const users = [{
    username: "marc", 
    coins: 10000, 
    position: null,
    activeChallenge: null
}, {
    username: "henry", 
    coins: 100, 
    position: null,
    activeChallenge: null
}];
const challenges = [{title: "Challenge 1", description: "Challenge 1 description", reward: 100}, {title: "Challenge 2", description: "Challenge 2 description", reward: 200}];

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
    
    // Find the user in the users array
    const user = users.find(user => 
        user.username.toLowerCase() === username.toLowerCase()
    );
    
    // Send back both existence status and coins if user exists
    res.json({
        exists: !!user,
        coins: user ? user.coins : null,
        activeChallenge: user ? user.activeChallenge : null
    });
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

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
app.get('/data', (req, res) => {
    res.json(users);
});