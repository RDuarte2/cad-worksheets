// Import Firebase functions
import { database } from './firebase.js';
import { ref, set, get, remove, onValue } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

var app = (function () {

    // Device management system
    var devices = {
        sensors: [],
        actuators: []
    };

    var deviceIdCounter = 1;
    var firebaseInitialized = false;

    // Initialize with existing devices from HTML (fallback)
    function initializeDevices() {
        // Scan existing sensors and actuators from the dashboard
        $('.zone-card').each(function () {
            const zoneName = $(this).find('.zone-title').text().trim();
            const zoneId = zoneName.toLowerCase().replace(/\s+/g, '-');

            // Get sensors
            $(this).find('.sensor-item').each(function () {
                const sensorName = $(this).find('.sensor-name').text().trim();
                const sensorValue = $(this).find('.sensor-value').text().trim();
                const icon = $(this).find('.sensor-name i').attr('class');

                // Check if it's not an actuator
                if (!$(this).find('.actuator-btn').length) {
                    const currentId = deviceIdCounter++;
                    // Add data-device-id to element
                    $(this).attr('data-device-id', currentId);
                    
                    devices.sensors.push({
                        id: currentId,
                        name: sensorName,
                        zone: zoneName,
                        zoneId: zoneId,
                        value: sensorValue,
                        icon: icon,
                        element: $(this)
                    });
                }
            });

            // Get actuators
            $(this).find('.actuator-btn').each(function () {
                const $item = $(this).closest('.sensor-item');
                const actuatorName = $item.find('.sensor-name').text().trim();
                const icon = $item.find('.sensor-name i').attr('class');
                const isActive = $(this).hasClass('active');
                const currentId = deviceIdCounter++;

                // Add data-device-id to element
                $item.attr('data-device-id', currentId);

                devices.actuators.push({
                    id: currentId,
                    name: actuatorName,
                    zone: zoneName,
                    zoneId: zoneId,
                    status: isActive ? 'Ativo' : 'Desligado',
                    icon: icon,
                    element: $item
                });
            });
        });

        updateDeviceTable();
        updateSensorCount();
        saveDevicesToFirebase()
    }

    // Load devices from Firebase
    async function loadDevicesFromFirebase() {
        try {
            const devicesRef = ref(database, 'smartcity/devices');
            const snapshot = await get(devicesRef);
            
            if (snapshot.exists()) {
                const firebaseDevices = snapshot.val();
                
                // Clear existing dashboard zones
                $('.zone-card').each(function() {
                    $(this).find('.sensor-item').remove();
                });
                
                devices.sensors = [];
                devices.actuators = [];
                
                // Find max ID to continue counter
                let maxId = 0;
                
                // Load sensors
                if (firebaseDevices.sensors) {
                    Object.values(firebaseDevices.sensors).forEach(sensor => {
                        if (sensor.id > maxId) maxId = sensor.id;
                        addSensorToDOM(sensor);
                        devices.sensors.push(sensor);
                    });
                }
                
                // Load actuators
                if (firebaseDevices.actuators) {
                    Object.values(firebaseDevices.actuators).forEach(actuator => {
                        if (actuator.id > maxId) maxId = actuator.id;
                        addActuatorToDOM(actuator);
                        devices.actuators.push(actuator);
                    });
                }
                
                deviceIdCounter = maxId + 1;
                updateDeviceTable();
                updateSensorCount();
                
                console.log('Dispositivos carregados do Firebase com sucesso!');
                firebaseInitialized = true;
            } else {
                console.log('Nenhum dispositivo encontrado no Firebase. Usando dispositivos padrão.');
                initializeDevices();
            }
        } catch (error) {
            console.error('Erro ao carregar dispositivos do Firebase:', error);
            initializeDevices();
        }
    }

    // Save devices to Firebase
    async function saveDevicesToFirebase() {
        try {
            const devicesRef = ref(database, 'smartcity/devices');
            
            // Convert arrays to objects for Firebase
            const sensorsObj = {};
            devices.sensors.forEach(sensor => {
                sensorsObj[sensor.id] = {
                    id: sensor.id,
                    name: sensor.name,
                    zone: sensor.zone,
                    zoneId: sensor.zoneId,
                    value: sensor.value,
                    icon: sensor.icon
                };
            });
            
            const actuatorsObj = {};
            devices.actuators.forEach(actuator => {
                actuatorsObj[actuator.id] = {
                    id: actuator.id,
                    name: actuator.name,
                    zone: actuator.zone,
                    zoneId: actuator.zoneId,
                    status: actuator.status,
                    icon: actuator.icon
                };
            });
            
            await set(devicesRef, {
                sensors: sensorsObj,
                actuators: actuatorsObj
            });
            
            console.log('Dispositivos salvos no Firebase com sucesso!');
        } catch (error) {
            if (error.message.includes('PERMISSION_DENIED') || error.message.includes('Permission denied')) {
                console.warn('⚠️ Permissões do Firebase não configuradas. Os dados não serão salvos.');
                console.warn('Configure as regras do Firebase Realtime Database para permitir leitura/escrita.');
            } else {
                console.error('Erro ao salvar dispositivos no Firebase:', error);
            }
        }
    }

    // Add sensor to DOM
    function addSensorToDOM(sensor) {
        const sensorHtml = `
            <div class="sensor-item" data-device-id="${sensor.id}">
                <span class="sensor-name">
                    <i class="${sensor.icon}"></i>
                    ${sensor.name}
                </span>
                <span class="sensor-value">${sensor.value}</span>
            </div>
        `;
        
        // Find the zone and add sensor
        $('.zone-card').each(function () {
            const cardZone = $(this).find('.zone-title').text().trim();
            if (cardZone === sensor.zone) {
                const actuatorsHeader = $(this).find('h6').filter(function() {
                    return $(this).text().includes('Atuadores');
                });
                
                if (actuatorsHeader.length) {
                    actuatorsHeader.before(sensorHtml);
                } else {
                    $(this).append(sensorHtml);
                }
            }
        });
    }

    // Add actuator to DOM
    function addActuatorToDOM(actuator) {
        const isActive = actuator.status === 'Ativo' || actuator.status === 'Ligado';
        const actuatorHtml = `
            <div class="sensor-item" data-device-id="${actuator.id}">
                <span class="sensor-name">
                    <i class="${actuator.icon}"></i>
                    ${actuator.name}
                </span>
                <button class="actuator-btn ${isActive ? 'active' : 'inactive'}" onclick="toggleActuator(this)">
                    <i class="bi bi-toggle-${isActive ? 'on' : 'off'}"></i> ${isActive ? 'Ligado' : 'Desligado'}
                </button>
            </div>
        `;
        
        // Find the zone and add actuator
        $('.zone-card').each(function () {
            const cardZone = $(this).find('.zone-title').text().trim();
            if (cardZone === actuator.zone) {
                const actuatorsHeader = $(this).find('h6').filter(function() {
                    return $(this).text().includes('Atuadores');
                });
                
                if (actuatorsHeader.length) {
                    actuatorsHeader.after(actuatorHtml);
                } else {
                    $(this).append(actuatorHtml);
                }
            }
        });
    }

    // Update the device count
    function updateSensorCount() {
        $('#activeSensors').text(devices.sensors.length + devices.actuators.length);
    }

    // Toggle actuator
    function toggleActuator(btn) {
        const $btn = $(btn);
        const deviceId = $btn.closest('.sensor-item').attr('data-device-id');

        let newStatus;
        if ($btn.hasClass('active')) {
            $btn.removeClass('active').addClass('inactive');
            $btn.html('<i class="bi bi-toggle-off"></i> Desligado');
            newStatus = 'Desligado';
        } else {
            $btn.removeClass('inactive').addClass('active');
            $btn.html('<i class="bi bi-toggle-on"></i> Ligado');
            newStatus = 'Ativo';
        }

        // Update status in devices array
        if (deviceId) {
            const actuator = devices.actuators.find(a => a.id == deviceId);
            if (actuator) {
                actuator.status = newStatus;
                // Update status in table
                $(`#deviceTableBody tr[data-device-id="${deviceId}"] td:eq(3)`).html(
                    `<span class="status-indicator status-online"></span> ${newStatus}`
                );
                
                // Save to Firebase
                saveDevicesToFirebase();
            }
        }
    }

    // Simulate real-time data updates
    function simulateDataUpdate() {
        // Update temperature
        const temp = (20 + Math.random() * 5).toFixed(1);
        $('#avgTemp').text(temp + '°C');

        // Update humidity
        const humidity = Math.floor(60 + Math.random() * 15);
        $('#avgHumidity').text(humidity + '%');

        // Update active lights
        const lights = Math.floor(150 + Math.random() * 20);
        $('#lightsOn').text(lights);

        // Randomly show alert
        if (Math.random() > 0.9) {
            $('#alertBanner').slideDown();
            setTimeout(() => {
                $('#alertBanner').slideUp();
            }, 5000);
        }
    }

    setInterval(simulateDataUpdate, 5000);

    // Range input updates
    $('input[type="range"]').on('input', function () {
        const value = $(this).val();
        const unit = $(this).parent().find('.badge-custom').text().match(/lux|%|dB/) || '';
        $(this).parent().find('.badge-custom').text(value + ' ' + unit);
    });

    // Smooth scroll and fade effects
    $(document).ready(function () {
        $('.glass-card').hide().fadeIn(1000);

        $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
            $('.glass-card').hide().fadeIn(500);
        });

        // Initialize device management - Load from Firebase first
        loadDevicesFromFirebase();

        // Add sensor functionality
        $('#addSensorBtn').on('click', addSensor);

        // Add actuator functionality
        $('#addActuatorBtn').on('click', addActuator);
    });

    // Sensor types configuration
    const sensorTypes = {
        'Temperatura': { icon: 'bi bi-thermometer', unit: '°C', color: 'var(--info)' },
        'Humidade': { icon: 'bi bi-droplet', unit: '%', color: 'var(--primary)' },
        'Luminosidade': { icon: 'bi bi-brightness-high', unit: 'lux', color: 'var(--warning)' },
        'Qualidade do Ar': { icon: 'bi bi-wind', unit: '', color: 'var(--success)' },
        'Ruído': { icon: 'bi bi-volume-up', unit: 'dB', color: 'var(--danger)' },
        'Humidade do Solo': { icon: 'bi bi-moisture', unit: '%', color: 'var(--success)' }
    };

    // Actuator types configuration
    const actuatorTypes = {
        'Iluminação Pública': { icon: 'bi bi-lightbulb-fill' },
        'Sistema de Rega': { icon: 'bi bi-droplet-fill' },
        'Câmaras de Segurança': { icon: 'bi bi-camera-video' },
        'Ventilação': { icon: 'bi bi-fan' },
        'Sistema de Alerta': { icon: 'bi bi-exclamation-triangle' }
    };

    // Add sensor function
    function addSensor() {
        const zone = $('#sensorZoneSelect').val();
        const type = $('#sensorTypeSelect').val();

        if (!zone || zone === 'Selecionar Zona') {
            alert('Por favor, selecione uma zona');
            return;
        }

        if (!type || type === 'Tipo de Sensor') {
            alert('Por favor, selecione um tipo de sensor');
            return;
        }

        const sensorConfig = sensorTypes[type];
        const zoneId = zone.toLowerCase().replace(/\s+/g, '-');
        const randomValue = (Math.random() * 100).toFixed(1);
        const value = randomValue + (sensorConfig.unit ? ' ' + sensorConfig.unit : '');

        // Create sensor element
        const sensorHtml = `
            <div class="sensor-item" data-device-id="${deviceIdCounter}">
                <span class="sensor-name">
                    <i class="${sensorConfig.icon}" style="color: ${sensorConfig.color};"></i>
                    ${type}
                </span>
                <span class="sensor-value" style="color: ${sensorConfig.color};">${value}</span>
            </div>
        `;

        // Find the zone and add sensor
        $('.zone-card').each(function () {
            const cardZone = $(this).find('.zone-title').text().trim();
            if (cardZone === zone) {
                // Find the sensors section (h6 with "Sensores") and add after the last sensor
                const sensorsHeader = $(this).find('h6').filter(function () {
                    return $(this).text().includes('Sensores');
                });
                const actuatorsHeader = $(this).find('h6').filter(function () {
                    return $(this).text().includes('Atuadores');
                });

                if (actuatorsHeader.length) {
                    // Insert before the actuators header
                    actuatorsHeader.before(sensorHtml);
                } else if (sensorsHeader.length) {
                    // Find last sensor-item before any actuator button and add after it
                    const lastSensor = sensorsHeader.nextAll('.sensor-item').filter(function () {
                        return $(this).find('.actuator-btn').length === 0;
                    }).last();
                    if (lastSensor.length) {
                        lastSensor.after(sensorHtml);
                    } else {
                        sensorsHeader.after(sensorHtml);
                    }
                } else {
                    // Fallback: add at the end
                    $(this).append(sensorHtml);
                }
            }
        });

        // Add to devices array
        devices.sensors.push({
            id: deviceIdCounter,
            name: type,
            zone: zone,
            zoneId: zoneId,
            value: value,
            icon: sensorConfig.icon
        });

        deviceIdCounter++;
        updateDeviceTable();
        updateSensorCount();
        
        // Save to Firebase
        saveDevicesToFirebase();

        alert('Sensor adicionado com sucesso!');
    }

    // Add actuator function
    function addActuator() {
        const zone = $('#actuatorZoneSelect').val();
        const type = $('#actuatorTypeSelect').val();

        if (!zone || zone === 'Selecionar Zona') {
            alert('Por favor, selecione uma zona');
            return;
        }

        if (!type || type === 'Tipo de Atuador') {
            alert('Por favor, selecione um tipo de atuador');
            return;
        }

        const actuatorConfig = actuatorTypes[type];
        const zoneId = zone.toLowerCase().replace(/\s+/g, '-');

        // Create actuator element
        const actuatorHtml = `
            <div class="sensor-item" data-device-id="${deviceIdCounter}">
                <span class="sensor-name">
                    <i class="${actuatorConfig.icon}"></i>
                    ${type}
                </span>
                <button class="actuator-btn inactive" onclick="toggleActuator(this)">
                    <i class="bi bi-toggle-off"></i> Desligado
                </button>
            </div>
        `;

        // Find the zone and add actuator
        $('.zone-card').each(function () {
            const cardZone = $(this).find('.zone-title').text().trim();
            if (cardZone === zone) {
                // Find the actuators section header
                const actuatorsHeader = $(this).find('h6').filter(function () {
                    return $(this).text().includes('Atuadores');
                });

                if (actuatorsHeader.length) {
                    // Find last actuator item (items with actuator-btn) and add after it
                    const lastActuator = actuatorsHeader.nextAll('.sensor-item').filter(function () {
                        return $(this).find('.actuator-btn').length > 0;
                    }).last();

                    if (lastActuator.length) {
                        lastActuator.after(actuatorHtml);
                    } else {
                        // No actuators yet, add right after the header
                        actuatorsHeader.after(actuatorHtml);
                    }
                } else {
                    // No actuators section, add at the end
                    $(this).append(actuatorHtml);
                }
            }
        });

        // Add to devices array
        devices.actuators.push({
            id: deviceIdCounter,
            name: type,
            zone: zone,
            zoneId: zoneId,
            status: 'Desligado',
            icon: actuatorConfig.icon
        });

        deviceIdCounter++;
        updateDeviceTable();
        updateSensorCount();
        
        // Save to Firebase
        saveDevicesToFirebase();

        alert('Atuador adicionado com sucesso!');
    }

    // Update device table
    function updateDeviceTable() {
        const tbody = $('#deviceTableBody');
        tbody.empty();

        // Add sensors
        devices.sensors.forEach(function (sensor) {
            const row = `
                <tr data-device-id="${sensor.id}" data-device-type="sensor">
                    <td>${sensor.zone}</td>
                    <td>${sensor.name}</td>
                    <td><span class="badge-custom bg-info">Sensor</span></td>
                    <td><span class="status-indicator status-online"></span> Online</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="app.removeDevice(${sensor.id}, 'sensor')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });

        // Add actuators
        devices.actuators.forEach(function (actuator) {
            const row = `
                <tr data-device-id="${actuator.id}" data-device-type="actuator">
                    <td>${actuator.zone}</td>
                    <td>${actuator.name}</td>
                    <td><span class="badge-custom bg-success">Atuador</span></td>
                    <td><span class="status-indicator status-online"></span> ${actuator.status}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="app.removeDevice(${actuator.id}, 'actuator')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    // Remove device function
    function removeDevice(deviceId, deviceType) {
        if (!confirm('Tem certeza que deseja remover este dispositivo?')) {
            return;
        }

        // Remove from array
        if (deviceType === 'sensor') {
            const index = devices.sensors.findIndex(s => s.id === deviceId);
            if (index > -1) {
                devices.sensors.splice(index, 1);
            }
        } else {
            const index = devices.actuators.findIndex(a => a.id === deviceId);
            if (index > -1) {
                devices.actuators.splice(index, 1);
            }
        }

        // Remove from dashboard
        $(`.zone-card .sensor-item[data-device-id="${deviceId}"]`).fadeOut(300, function () {
            $(this).remove();
        });

        // Remove from table
        $(`#deviceTableBody tr[data-device-id="${deviceId}"]`).fadeOut(300, function () {
            $(this).remove();
        });

        updateSensorCount();
        
        // Save to Firebase
        saveDevicesToFirebase();
    }


    // Weather API functionality
    var weatherUpdateInterval = null;

    // Function to capitalize first letter of each word
    function capitalizeWords(str) {
        return str.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    }

    function fetchWeatherData() {
        var apiUrl = 'https://api.openweathermap.org/data/2.5/weather?units=metric&q=leiria&appid=c00bd5f16b4fb9f6f6dcbe3cabdf9828';

        $.ajax({
            url: apiUrl,
            dataType: 'json'
        })
            .done(function (weather) {
                // Update current temperature
                $('#curTemperature').text(weather.main.temp.toFixed(1) + ' °C');

                // Update Weather with capitalized text
                var weatherDesc = capitalizeWords(weather.weather[0].description);
                $('#weatherDescription').text(weatherDesc);

                // Update weather icon
                var iconCode = weather.weather[0].icon;
                var iconUrl = 'https://openweathermap.org/img/wn/' + iconCode + '@2x.png';
                $('.weather-icon').html('<img src="' + iconUrl + '" alt="Weather Icon">');

                const now = new Date();
                const timeStr = now.toLocaleTimeString('pt-PT');
                $('#lastUpdate').text(timeStr);

            })
            .fail(function (jqXHR, textStatus, error) {
                console.error('Error:', error);  // Debug line
                alert('Error fetching weather data: ' + error);
            });
    }

    $(document).ready(function () {
        // Auto-update every 1 minute (60000 ms)
        weatherUpdateInterval = setInterval(fetchWeatherData, 60000);

        // Initial fetch on page load
        fetchWeatherData();
    });

    // Expose functions globally
    return {
        toggleActuator: toggleActuator,
        removeDevice: removeDevice,
        saveDevicesToFirebase: saveDevicesToFirebase
    };

})();

// Make functions available globally for inline onclick handlers
window.toggleActuator = function(btn) {
    if (app && app.toggleActuator) {
        app.toggleActuator(btn);
    }
};

window.app = app;
