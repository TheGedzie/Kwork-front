const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

let today = new Date();
let selected = new Date(today);

let currentYear = selected.getFullYear();
let currentMonth = selected.getMonth();
let currentWeekIndex = 0;

const label = document.getElementById("monthLabel");
const daysBox = document.getElementById("days");
const weekdaysBox = document.getElementById("weekdays");
const mWeekBox = document.getElementById("mWeek");
const mWeekdays = document.getElementById("mWeekdays");
const ticketDateSpan = document.getElementById("ticketDate");

/* ---------- UTILITIES ---------- */
function getMonthMatrix(year, month) {
    let matrix = [];
    let firstDay = new Date(year, month, 1);
    let startOffset = (firstDay.getDay() + 6) % 7;
    let daysInMonth = new Date(year, month + 1, 0).getDate();

    let total = startOffset + daysInMonth;
    let rows = Math.ceil(total / 7);

    let day = 1;
    for (let r = 0; r < rows; r++) {
        let row = [];
        for (let c = 0; c < 7; c++) {
            let index = r * 7 + c;
            if (index < startOffset || index >= startOffset + daysInMonth) {
                row.push(null);
            } else {
                row.push(new Date(year, month, day++));
            }
        }
        matrix.push(row);
    }

    return matrix;
}

function isSameDay(a,b){
    return a.getFullYear()===b.getFullYear() &&
           a.getMonth()===b.getMonth() &&
           a.getDate()===b.getDate();
}

function updateTicketInfo(date){
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    ticketDateSpan.textContent = date.toLocaleDateString('en-US', options);
}

/* ---------- DESKTOP RENDER ---------- */
function renderDesktop(matrix) {
    weekdaysBox.innerHTML = `
        <div>Mon</div><div>Tue</div><div>Wed</div>
        <div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
    `;

    daysBox.innerHTML = "";

    matrix.forEach(row => {
        row.forEach(d => {
            let div = document.createElement("div");
            div.className = "day";

            if (!d) {
                div.classList.add("empty");
            } else {
                div.textContent = d.getDate();

                if (isSameDay(d, selected)) div.classList.add("selected");
                if (isSameDay(d, today)) div.classList.add("today");

                div.onclick = () => {
                    selected = new Date(d);
                    currentYear = d.getFullYear();
                    currentMonth = d.getMonth();
                    render();
                    updateTicketInfo(selected);
                };
            }

            daysBox.appendChild(div);
        });
    });
}

/* ---------- MOBILE RENDER ---------- */
function renderMobile(matrix) {
    if (selected.getMonth() !== currentMonth || selected.getFullYear() !== currentYear) {
        selected = new Date(currentYear, currentMonth, 1);
    }

    currentWeekIndex = matrix.findIndex(row =>
        row.some(d => d && isSameDay(d, selected))
    );

    if (currentWeekIndex < 0) currentWeekIndex = 0;

    mWeekBox.innerHTML = "";

    let week = matrix[currentWeekIndex] || matrix[0];

    week.forEach(d => {
        let div = document.createElement("div");
        div.className = "mobile-day";

        if (d) {
            div.textContent = d.getDate();

            if (isSameDay(d, selected)) div.classList.add("mobile-selected");
            if (isSameDay(d, today)) div.classList.add("today");

            div.onclick = () => {
                selected = new Date(d);
                currentYear = d.getFullYear();
                currentMonth = d.getMonth();
                render();
                updateTicketInfo(selected);
            };
        }

        mWeekBox.appendChild(div);
    });
}

/* ---------- MAIN RENDER ---------- */
function render() {
    label.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    let matrix = getMonthMatrix(currentYear, currentMonth);

    if (window.innerWidth > 950) {
        weekdaysBox.style.display = "grid";
        daysBox.style.display = "grid";
        renderDesktop(matrix);

        mWeekBox.style.display = "none";
        mWeekdays.style.display = "none";
    } else {
        weekdaysBox.style.display = "none";
        daysBox.style.display = "none";

        mWeekBox.style.display = "grid";
        mWeekdays.style.display = "grid";

        renderMobile(matrix);
    }

    updateTicketInfo(selected);
}

/* ---------- BUTTONS ---------- */
document.getElementById("prev").onclick = () => {
    let matrix = getMonthMatrix(currentYear, currentMonth);

    if (window.innerWidth <= 950) {
        currentWeekIndex--;
        if (currentWeekIndex < 0) {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            matrix = getMonthMatrix(currentYear, currentMonth);
            currentWeekIndex = matrix.length - 1;
        }
        selected = matrix[currentWeekIndex].find(x => x) || selected;
    } else {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
    }
    render();
};

document.getElementById("next").onclick = () => {
    let matrix = getMonthMatrix(currentYear, currentMonth);

    if (window.innerWidth <= 950) {
        currentWeekIndex++;
        if (currentWeekIndex >= matrix.length) {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            matrix = getMonthMatrix(currentYear, currentMonth);
            currentWeekIndex = 0;
        }
        selected = matrix[currentWeekIndex].find(x => x) || selected;
    } else {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
    }
    render();
};

window.onresize = render;

render();

const allBtns = document.querySelectorAll('.buy');

allBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.textContent = "Selected";
    });
});