
        // Add hover effects to weather cells
        document.querySelectorAll('.weather-cell').forEach(cell => {
            cell.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.05)';
            });
            
            cell.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
        });

        // Add click functionality to sidebar icons
        document.querySelectorAll('.nav-icon').forEach(icon => {
            icon.addEventListener('click', function() {
                this.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
            });
        });

        // Pampanga municipalities with coordinates (same order as rows)
        const pampangaMunicipalities = [
            { name: "ANGELES", coords: [15.14336011, 120.59051810] },
            { name: "APALIT", coords: [14.94997653, 120.75675619] },
            { name: "ARAYAT", coords: [15.16593002, 120.78159403] },
            { name: "BACOLOR", coords: [15.03378028, 120.62071385] },
            { name: "CANDABA", coords: [15.10580611, 120.87269784] },
            { name: "FLORID...", coords: [14.93617972, 120.48914087] },
            { name: "GUAGUA", coords: [14.9661957, 120.63310490] },
            { name: "LUBAO", coords: [14.90217987, 120.55094493] },
            { name: "MABAL", coords: [15.22089063, 120.57105409] },
            { name: "MACABEBE", coords: [14.91324103, 120.67347402] },
            { name: "MAGALANG", coords: [15.2478282, 120.68086630] },
            { name: "MASANTOL", coords: [14.85194769, 120.67746495] },
            { name: "MEXICO", coords: [15.06633515, 120.71217193] },
            { name: "MINALIN", coords: [14.95365406, 120.70039268] },
            { name: "PORAC", coords: [15.1241602, 120.45899588] },
            { name: "SAN FERNANDO", coords: [15.05961285, 120.65646538] },
            { name: "SAN LUIS", coords: [15.01880145, 120.81164009] },
            { name: "SAN SIMON", coords: [14.9940879, 120.77563412] },
            { name: "SANTA ANA", coords: [15.10942466, 120.77008266] },
            { name: "SANTA RITA", coords: [15.00866765, 120.60767406] },
            { name: "SANTO TOMAS", coords: [15.00884912, 120.71039539] },
            { name: "SASMUAN", coords: [14.88693929, 120.61290981] }
        ];

        // Helper to get the correct row for a municipality
        function getRowByName(name) {
            const rows = document.querySelectorAll('.municipality-row');
            for (let row of rows) {
                const label = row.querySelector('.municipality-name');
                if (label && label.textContent.replace(/\s+/g, '').toUpperCase().startsWith(name.replace(/\s+/g, '').toUpperCase())) {
                    return row;
                }
            }
            return null;
        }

        // Fetch rainfall data for all municipalities and update the table
        async function fetchAndUpdateRainfall() {
            for (let muni of pampangaMunicipalities) {
                let lat = muni.coords[0];
                let lon = muni.coords[1];
                let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=auto`;
                try {
                    let res = await fetch(url);
                    let data = await res.json();
                    if (data.daily && data.daily.precipitation_sum) {
                        let row = getRowByName(muni.name);
                        if (row) {
                            let cells = row.querySelectorAll('.weather-cell .weather-text');
                            for (let i = 0; i < Math.min(7, data.daily.precipitation_sum.length); i++) {
                                cells[i].innerHTML = `${Math.round(data.daily.precipitation_sum[i])}mm<br>rainfall`;
                            }
                        }
                    }
                } catch (e) {
                    // Optionally handle error
                }
            }
        }

        // Run on page load
        fetchAndUpdateRainfall();
  