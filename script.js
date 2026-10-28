
class Heat {
    constructor(number, furnace, weight, startTime) {
        this.number = number;
        this.furnace = furnace;
        this.weight = Number(weight);
        this.startTime = startTime;
        this.status = "In Progress";
    }
}

const heats = [];

const heatForm = document.getElementById("heat-form");
const counterText = document.getElementById("active-heats");
const heatList = document.getElementById("heat-list");

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
