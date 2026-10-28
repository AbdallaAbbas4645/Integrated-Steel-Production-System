
class Heat {
    constructor(number, furnace, weight, startTime) {
        this.number = number;
        this.furnace = furnace;
        this.weight = Number(weight);
        this.startTime = startTime;
        this.status = "In Progress";
    }
}

// Supabase connection
const SUPABASE_URL = "https://pkmuoqnwuqnnynpyytmh.supabase.co";
const SUPABASE_KEY = "sb_publishable_vLo7YDy4GATGMtwFSizs7A_pgn-ll-q";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Page elements
const loginSection = document.getElementById("login-section");
const dashboardSection = document.getElementById("dashboard-section");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const logoutButton = document.getElementById("logout-btn");

const heatForm = document.getElementById("heat-form");
const counterText = document.getElementById("active-heats");
const heatList = document.getElementById("heat-list");

const heats = [];

// Show or hide the dashboard
function updateInterface(session) {
    const signedIn = Boolean(session);

    loginSection.hidden = signedIn;
    dashboardSection.hidden = !signedIn;

    if (!signedIn) {
        heats.length = 0;
        displayHeats();
    }
}

// Login
loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    loginMessage.textContent = "Signing in...";

    const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        loginMessage.textContent = "Login failed: " + error.message;
        return;
    }

    loginMessage.textContent = "";
    loginForm.reset();
});

// Logout
logoutButton.addEventListener("click", async function() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Logout failed: " + error.message);
    }
});

// Monitor login status
supabaseClient.auth.onAuthStateChange(function(event, session) {
    updateInterface(session);
});

// Display registered heats
function displayHeats() {
    counterText.textContent = "Active Heats: " + heats.length;

    heatList.replaceChildren();

    heats.forEach(function(heat) {
        const item = document.createElement("li");

        item.textContent =
            heat.number + " | Furnace " + heat.furnace +
            " | " + heat.weight + " tons | " +
            heat.startTime.replace("T", " ") +
            " | " + heat.status;

        heatList.appendChild(item);
    });
}

// Add a test heat
heatForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const number = document.getElementById("heat-number").value.trim();
    const furnace = document.getElementById("furnace").value;
    const weight = document.getElementById("weight").value;
    const startTime = document.getElementById("start-time").value;

    const alreadyExists = heats.some(function(heat) {
        return heat.number.toLowerCase() === number.toLowerCase();
    });

    if (alreadyExists) {
        alert("This heat number already exists.");
        return;
    }

    const newHeat = new Heat(number, furnace, weight, startTime);

    heats.push(newHeat);
    displayHeats();
    heatForm.reset();
});

displayHeats();
