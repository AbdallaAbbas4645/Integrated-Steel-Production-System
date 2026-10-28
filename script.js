let activeHeats = 0;

const counterText = document.getElementById("active-heats");

const addHeatButton = document.getElementById("add-heat-btn");

function updateCounter() {
    counterText.textContent = "Active Heats: " + activeHeats;
}

addHeatButton.addEventListener("click", function() {
    activeHeats = activeHeats + 1;
    updateCounter();
});

updateCounter();
