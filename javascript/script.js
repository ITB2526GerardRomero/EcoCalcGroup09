document.addEventListener("DOMContentLoaded", () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('start-date-input').valueAsDate = firstDayOfMonth;
    document.getElementById('end-date-input').valueAsDate = today;
    document.getElementById('current-year').textContent = today.getFullYear();

    let doughnutChart = null;
    let barChart = null;

    // Constants
    const REDUCTION_GOALS = [0, 0.10, 0.20, 0.30]; // 0%, 10%, 20%, 30% progressive goals

    // Get DOM Elements
    const inputs = document.querySelectorAll('.data-input');
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    const daysCountEl = document.getElementById('days-count');
    const timelineSlider = document.getElementById('timeline-slider');
    const seasonalInsightsEl = document.getElementById('seasonal-insights');
    const seasonalTextEl = document.getElementById('seasonal-text');
    const totalCostEl = document.getElementById('total-cost');
    const savingsAmountEl = document.getElementById('savings-amount');
    const costBarEl = document.getElementById('cost-bar');
    const costLegendEl = document.getElementById('cost-legend');

    // Colors for charts and UI
    const colors = {
        elec: '#f59e0b',  // Yellow-500
        water: '#3b82f6', // Blue-500
        office: '#a855f7',// Purple-500
        clean: '#14b8a6'  // Teal-500
    };

    // Main Calculation Function
    function updateCalculations() {
        // Calculate total days from selected period
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        let daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // Prevent negative days if End Date is before Start Date
        if (isNaN(daysDiff) || daysDiff < 1) {
            daysDiff = 1;
            endDateInput.value = startDateInput.value;
        }
        
        // Update UI with days count
        if(daysCountEl) {
            daysCountEl.textContent = `${daysDiff} ${daysDiff === 1 ? 'day' : 'days'}`;
        }

        // --- 1. Calculate Seasonal & Temporal Factors based on dates ---
        let factors = { elec: 0, water: 0, office: 0, clean: 0 };
        let currentDt = new Date(startDate);
        let hasWinter = false, hasSummer = false, hasExams = false;

        while (currentDt <= endDate) {
            const month = currentDt.getMonth();
            let fE = 1.0, fW = 1.0, fO = 1.0, fC = 1.0;

            // Summer (Jul, Aug): High water, low energy/paper
            if (month === 6 || month === 7) { 
                fW = 1.3; fE = 0.8; fO = 0.4; hasSummer = true;
            }
            // Winter (Dec, Jan, Feb): High energy (heating)
            else if (month === 11 || month === 0 || month === 1) { 
                fE = 1.3; hasWinter = true;
            }
            // Exams / Enrollment / Start (May, Jun, Sep, Oct): High paper/materials
            else if (month === 4 || month === 5 || month === 8 || month === 9) { 
                fO = 1.4; fC = 1.2; hasExams = true;
            }

            factors.elec += fE; factors.water += fW; factors.office += fO; factors.clean += fC;
            currentDt.setDate(currentDt.getDate() + 1);
        }

        // Average the factors over the selected period
        const avgFactors = {
            elec: factors.elec / daysDiff,
            water: factors.water / daysDiff,
            office: factors.office / daysDiff,
            clean: factors.clean / daysDiff
        };

        // Update Seasonal Insights UI
        let insights = [];
        if(hasWinter) insights.push("Winter (Heating increases energy).");
        if(hasSummer) insights.push("Summer (Higher water usage, less paper).");
        if(hasExams) insights.push("Exam/Start period (Paper & materials peak).");
        
        if(insights.length > 0) {
            seasonalInsightsEl.classList.remove('hidden');
            seasonalTextEl.textContent = "Seasonal adjustments active: " + insights.join(" ");
        } else {
            seasonalInsightsEl.classList.add('hidden');
        }

        // Get raw values (Daily Avg * Days * Seasonal Factor)
        const rawData = {
            elec: {
                qty: (parseFloat(document.getElementById('elec-qty').value) || 0) * daysDiff * avgFactors.elec,
                cost: parseFloat(document.getElementById('elec-cost').value) || 0
            },
            water: {
                qty: (parseFloat(document.getElementById('water-qty').value) || 0) * daysDiff * avgFactors.water,
                cost: parseFloat(document.getElementById('water-cost').value) || 0
            },
            office: {
                qty: (parseFloat(document.getElementById('office-qty').value) || 0) * daysDiff * avgFactors.office,
                cost: parseFloat(document.getElementById('office-cost').value) || 0
            },
            clean: {
                qty: (parseFloat(document.getElementById('clean-qty').value) || 0) * daysDiff * avgFactors.clean,
                cost: parseFloat(document.getElementById('clean-cost').value) || 0
            }
        };

        // Calculate reductions from selected actions
        let reductions = { elec: 0, water: 0, office: 0, clean: 0 };
        document.querySelectorAll('.action-cb:checked').forEach(cb => {
            reductions[cb.dataset.category] += parseFloat(cb.dataset.saving);
        });

        // Calculate absolute projected savings based on selected actions
        const actionSavings = {
            elec: rawData.elec.qty * rawData.elec.cost * reductions.elec,
            water: rawData.water.qty * rawData.water.cost * reductions.water,
            office: rawData.office.qty * rawData.office.cost * reductions.office,
            clean: rawData.clean.qty * rawData.clean.cost * reductions.clean
        };
        const totalActionSavings = actionSavings.elec + actionSavings.water + actionSavings.office + actionSavings.clean;
        
        // Update the Action Savings Badge
        const actionSavingsEl = document.getElementById('action-savings-total');
        if(actionSavingsEl) {
            actionSavingsEl.textContent = totalActionSavings.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        }

        // Handle the Progressive Target Goal
        const timelineStep = parseInt(timelineSlider.value);
        const currentGoalTarget = REDUCTION_GOALS[timelineStep];
        const multiplier = 1 - currentGoalTarget;

        // Calculate costs
        const costs = {
            elec: (rawData.elec.qty * multiplier) * rawData.elec.cost,
            water: (rawData.water.qty * multiplier) * rawData.water.cost,
            office: (rawData.office.qty * multiplier) * rawData.office.cost,
            clean: (rawData.clean.qty * multiplier) * rawData.clean.cost
        };

        const totalCost = costs.elec + costs.water + costs.office + costs.clean;
        
        // Calculate absolute savings (always based on raw 100% data)
        const rawTotalCost = (rawData.elec.qty * rawData.elec.cost) + 
                             (rawData.water.qty * rawData.water.cost) + 
                             (rawData.office.qty * rawData.office.cost) + 
                             (rawData.clean.qty * rawData.clean.cost);
        const absoluteSavings = rawTotalCost * currentGoalTarget;

        // Update DOM Text
        totalCostEl.textContent = totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        
        // Update savings badge text
        const pctSaved = currentGoalTarget * 100;
        savingsAmountEl.textContent = absoluteSavings.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` € saved (at ${pctSaved}%)`;
        
        // Highlight total if goal is active
        if(currentGoalTarget > 0) {
            totalCostEl.classList.add('text-eco-400');
        } else {
            totalCostEl.classList.remove('text-eco-400');
        }

        // Update Mini Bar and Legend
        updateMiniBar(costs, totalCost);

        // Update Charts
        updateCharts(costs, rawData, currentGoalTarget, reductions);
    }

    function updateMiniBar(costs, total) {
        costBarEl.innerHTML = '';
        costLegendEl.innerHTML = '';

        if (total === 0) return;

        const categories = [
            { id: 'elec', label: 'Elec.', color: 'bg-yellow-500' },
            { id: 'water', label: 'Water', color: 'bg-blue-500' },
            { id: 'office', label: 'Office', color: 'bg-purple-500' },
            { id: 'clean', label: 'Clean.', color: 'bg-teal-500' }
        ];

        categories.forEach(cat => {
            const percentage = (costs[cat.id] / total) * 100;
            if(percentage > 0) {
                // Bar segment
                const div = document.createElement('div');
                div.className = `h-full ${cat.color}`;
                div.style.width = `${percentage}%`;
                div.title = `${cat.label}: ${percentage.toFixed(1)}%`;
                costBarEl.appendChild(div);

                // Legend text
                if(percentage > 5) {
                    const span = document.createElement('span');
                    span.textContent = `${cat.label} ${Math.round(percentage)}%`;
                    costLegendEl.appendChild(span);
                }
            }
        });
    }

    function updateCharts(costs, rawData, goalTarget, reductions) {
        const costData = [costs.elec, costs.water, costs.office, costs.clean];
        
        // Doughnut Chart (Cost Breakdown)
        if (doughnutChart) {
            doughnutChart.data.datasets[0].data = costData;
            doughnutChart.update();
        } else {
            const ctxDoughnut = document.getElementById('costDoughnutChart').getContext('2d');
            doughnutChart = new Chart(ctxDoughnut, {
                type: 'doughnut',
                data: {
                    labels: ['Electricity', 'Water', 'Office', 'Cleaning'],
                    datasets: [{
                        data: costData,
                        backgroundColor: [colors.elec, colors.water, colors.office, colors.clean],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Inter' } } },
                        tooltip: { callbacks: { label: function(context) { return ' ' + context.raw.toFixed(2) + ' €'; } } }
                    },
                    cutout: '70%'
                }
            });
        }

        // Bar Chart (Current vs Target vs Projected)
        const isGoalActive = goalTarget > 0;
        const targetPct = (1 - goalTarget) * 100;
        const targetData = [targetPct, targetPct, targetPct, targetPct]; 
        
        const projectedData = [
            Math.max(0, 100 - (reductions.elec * 100)),
            Math.max(0, 100 - (reductions.water * 100)),
            Math.max(0, 100 - (reductions.office * 100)),
            Math.max(0, 100 - (reductions.clean * 100))
        ];

        if (barChart) {
            barChart.data.datasets[0].data = isGoalActive ? targetData : [100, 100, 100, 100];
            barChart.data.datasets[0].backgroundColor = isGoalActive ? '#22c55e' : '#cbd5e1';
            
            if (barChart.data.datasets.length > 1) {
                barChart.data.datasets[1].data = projectedData;
            }
            
            // Update target line position dynamically
            barChart.data.datasets[2].data = targetData;
            barChart.data.datasets[2].label = `Target Goal (${targetPct}%)`;

            barChart.update();
        } else {
            const ctxBar = document.getElementById('targetBarChart').getContext('2d');
            barChart = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: ['Electricity', 'Water', 'Office', 'Cleaning'],
                    datasets: [
                        {
                            label: 'Current Level (%)',
                            data: [100, 100, 100, 100], // Start at 100 if no goal selected
                            backgroundColor: '#cbd5e1',
                            borderRadius: 4,
                            order: 2
                        },
                        {
                            label: 'Projected w/ Actions (%)',
                            data: projectedData,
                            backgroundColor: '#3b82f6',
                            borderRadius: 4,
                            order: 3
                        },
                        {
                            label: `Target Goal (${targetPct}%)`,
                            data: targetData,
                            type: 'line',
                            borderColor: '#16a34a',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 110,
                            ticks: { font: { family: 'Inter' } }
                        },
                        x: {
                            ticks: { font: { family: 'Inter' } }
                        }
                    },
                    plugins: {
                        legend: { 
                            display: true, 
                            position: 'bottom',
                            labels: { boxWidth: 12, font: { family: 'Inter' } } 
                        },
                        tooltip: { 
                            callbacks: { 
                                label: function(context) { 
                                    return context.dataset.label + ': ' + context.raw.toFixed(0) + '%'; 
                                } 
                            } 
                        }
                    }
                }
            });
        }
    }

    // Add Event Listeners
    inputs.forEach(input => {
        input.addEventListener('input', updateCalculations);
    });

    startDateInput.addEventListener('change', updateCalculations);
    endDateInput.addEventListener('change', updateCalculations);
    timelineSlider.addEventListener('input', updateCalculations);

    // Add Event Listeners for Action Checkboxes
    document.querySelectorAll('.action-cb').forEach(cb => {
        cb.addEventListener('change', updateCalculations);
    });

    // Initial Calculation
    updateCalculations();
});

