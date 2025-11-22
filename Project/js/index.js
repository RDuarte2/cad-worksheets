// Import Firebase functions
import { database } from './firebase.js';
import { ref, set, get, remove, onValue, update } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

var app = (function () {

    // Device management system
    var devices = {
        sensors: [],
        actuators: []
    };

    var deviceIdCounter = 1;
    var firebaseInitialized = false;
    var systemOnline = true; // Track if Raspberry Pi system is online
    
    // Alert management
    var activeAlerts = {}; // Track active alerts and their intervals
    
    // Automation rules
    var automationRules = {
        lighting: { active: true, threshold: 300, type: 'Luminosidade', actuator: 'Iluminação Pública' },
        irrigation: { active: true, threshold: 30, type: 'Humidade do Solo', actuator: 'Sistema de Rega' },
        airQuality: { active: true, level: 'moderada', type: 'Qualidade do Ar', actuator: 'Alertas de Poluição' },
        noise: { active: false, threshold: 75, type: 'Ruído', actuator: 'Alertas de Poluição Sonora' }
    };

    // Generate descriptive ID from name and zone
    function generateDeviceId(name, zone) {
        // Remove only special characters (not letters with accents) and spaces
        const cleanName = name.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '').replace(/\s+/g, '');
        const cleanZone = zone.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '').replace(/\s+/g, '');
        return `${cleanName}_${cleanZone}`;
    }

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
                    const deviceId = generateDeviceId(sensorName, zoneName);
                    // Add data-device-id to element
                    $(this).attr('data-device-id', deviceId);

                    devices.sensors.push({
                        id: deviceId,
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
                const deviceId = generateDeviceId(actuatorName, zoneName);

                // Add data-device-id to element
                $item.attr('data-device-id', deviceId);

                devices.actuators.push({
                    id: deviceId,
                    name: actuatorName,
                    zone: zoneName,
                    zoneId: zoneId,
                    status: isActive ? 'Ligado' : 'Desligado',
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
                $('.zone-card').each(function () {
                    $(this).find('.sensor-item').remove();
                });

                devices.sensors = [];
                devices.actuators = [];

                // Load sensors
                if (firebaseDevices.sensors) {
                    Object.values(firebaseDevices.sensors).forEach(sensor => {
                        addSensorToDOM(sensor);
                        devices.sensors.push(sensor);
                    });
                }

                // Load actuators
                if (firebaseDevices.actuators) {
                    Object.values(firebaseDevices.actuators).forEach(actuator => {
                        // Normalize status before adding to DOM
                        if (actuator.status === 'Ativo') {
                            actuator.status = 'Ligado';
                        }
                        addActuatorToDOM(actuator);
                        devices.actuators.push(actuator);
                    });
                }
                updateDeviceTable();
                updateSensorCount();
                updateAverageValues();
                
                // Show alerts for active pollution actuators
                devices.actuators.forEach(actuator => {
                    if (actuator.name.includes('Alertas de Poluição') && actuator.status === 'Ligado') {
                        const alertType = actuator.name.includes('Sonora') ? 'noise' : 'air';
                        const message = actuator.name.includes('Sonora') 
                            ? 'Nível de ruído acima do limite! Poluição sonora detetada.'
                            : 'Qualidade do ar degradada! Alertas de poluição ativos.';
                        showAlert(alertType, actuator.zone, message, actuator.name);
                    }
                });

                console.log('Dispositivos carregados do Firebase com sucesso!');
                firebaseInitialized = true;
                
                // Load automation rules
                loadAutomationRules();
                
                // Start listening for real-time updates after a small delay to ensure DOM is ready
                setTimeout(() => {
                    listenToSensorUpdates();
                }, 500);
            } else {
                console.log('Nenhum dispositivo encontrado no Firebase. Usando dispositivos padrão.');
                initializeDevices();
            }
        } catch (error) {
            console.error('Erro ao carregar dispositivos do Firebase:', error);
            initializeDevices();
        }
    }

    // Listen for real-time sensor updates from Firebase
    function listenToSensorUpdates() {
        const sensorsRef = ref(database, 'smartcity/devices/sensors');
        
        onValue(sensorsRef, (snapshot) => {
            if (snapshot.exists()) {
                const firebaseSensors = snapshot.val();
                console.log('Recebeu atualizações de sensores:', firebaseSensors);
                
                // Update sensor values in real-time
                Object.keys(firebaseSensors).forEach(sensorKey => {
                    const sensor = firebaseSensors[sensorKey];
                    
                    // Use the key as ID if sensor.id doesn't exist
                    const sensorId = sensor.id || sensorKey;
                    
                    // console.log(`Atualizando sensor ${sensorId}:`, sensor.value);
                    
                    // Find sensor in DOM and update value
                    const $sensorElement = $(`.sensor-item[data-device-id="${sensorId}"]`);
                    if ($sensorElement.length) {
                        if (sensor.value) {
                            $sensorElement.find('.sensor-value').text(sensor.value);
                            // console.log(`Valor atualizado para ${sensorId}: ${sensor.value}`);
                        }
                        
                        // Update in devices array
                        const localSensor = devices.sensors.find(s => s.id === sensorId);
                        if (localSensor && sensor.value) {
                            localSensor.value = sensor.value;
                            
                            // Check automation rules when sensor value changes
                            checkAutomationRules(localSensor);
                            
                            // Update average values in cards
                            updateAverageValues();
                        }
                    } else {
                        console.warn(`Sensor ${sensorId} não encontrado no DOM`);
                    }
                });
            }
        }, (error) => {
            console.error('Erro ao ouvir atualizações dos sensores:', error);
        });
        
        // Listen for actuator updates
        const actuatorsRef = ref(database, 'smartcity/devices/actuators');
        
        onValue(actuatorsRef, (snapshot) => {
            if (snapshot.exists()) {
                const firebaseActuators = snapshot.val();
                console.log('Recebeu atualizações de atuadores:', firebaseActuators);
                
                // Update actuator status in real-time
                Object.keys(firebaseActuators).forEach(actuatorKey => {
                    const actuator = firebaseActuators[actuatorKey];
                    
                    // Use the key as ID if actuator.id doesn't exist
                    const actuatorId = actuator.id || actuatorKey;
                    
                    console.log(`Atualizando atuador ${actuatorId}:`, actuator.status);
                    
                    // Find actuator in DOM and update button
                    const $actuatorElement = $(`.sensor-item[data-device-id="${actuatorId}"]`);
                    if ($actuatorElement.length && actuator.status) {
                        const $btn = $actuatorElement.find('.actuator-btn');
                        
                        // Normalize status: convert 'Ativo' to 'Ligado'
                        const normalizedStatus = actuator.status === 'Ativo' ? 'Ligado' : actuator.status;
                        
                        // Check current state to avoid unnecessary updates
                        const currentState = $btn.hasClass('active') ? 'Ligado' : 'Desligado';
                        
                        // Only update if state actually changed
                        if (currentState !== normalizedStatus) {
                            // Update button visual state
                            if (normalizedStatus === 'Ligado') {
                                $btn.addClass('active').removeClass('inactive');
                                $btn.html('<i class="bi bi-toggle-on"></i> Ligado');
                            } else {
                                $btn.removeClass('active').addClass('inactive');
                                $btn.html('<i class="bi bi-toggle-off"></i> Desligado');
                            }
                            
                            console.log(`Estado atualizado para ${actuatorId}: ${normalizedStatus}`);
                            
                            // Update in devices array
                            const localActuator = devices.actuators.find(a => a.id === actuatorId);
                            if (localActuator) {
                                localActuator.status = normalizedStatus;
                                
                                // Update device table
                                updateDeviceTable();
                                
                                // Update lights count if it's a lighting actuator
                                if (localActuator.name === 'Iluminação Pública') {
                                    updateActiveLights();
                                }
                                
                                // Show/hide alerts for pollution actuators
                                if (localActuator.name.includes('Alertas de Poluição')) {
                                    if (normalizedStatus === 'Ligado') {
                                        const alertType = localActuator.name.includes('Sonora') ? 'noise' : 'air';
                                        const message = localActuator.name.includes('Sonora') 
                                            ? 'Nível de ruído acima do limite! Poluição sonora detetada.'
                                            : 'Qualidade do ar degradada! Alertas de poluição ativos.';
                                        showAlert(alertType, localActuator.zone, message, localActuator.name);
                                    } else {
                                        hideAlert(localActuator.name);
                                    }
                                }
                            }
                        }
                    } else {
                        console.warn(`Atuador ${actuatorId} não encontrado no DOM`);
                    }
                });
            }
        }, (error) => {
            console.error('Erro ao ouvir atualizações dos atuadores:', error);
        });
        
        // Listen for status updates (lastUpdate time and online status)
        const statusRef = ref(database, 'smartcity/status');
        
        onValue(statusRef, (snapshot) => {
            if (snapshot.exists()) {
                const status = snapshot.val();
                
                // Update last update time
                if (status.lastUpdate) {
                    const lastUpdate = new Date(status.lastUpdate);
                    const timeStr = lastUpdate.toLocaleTimeString('pt-PT');
                    $('#lastUpdate').text(timeStr);
                }
                
                // Update online/offline status indicator in header
                if (status.online !== undefined) {
                    const $statusIndicator = $('.header .status-indicator');
                    const $systemStatus = $('#systemStatus');
                    if (status.online === 1) {
                        $statusIndicator.removeClass('status-offline').addClass('status-online');
                        $systemStatus.text('Sistema Operacional');
                    } else {
                        $statusIndicator.removeClass('status-online').addClass('status-offline');
                        $systemStatus.text('Sistema Offline');
                    }
                    
                    // Store system online status
                    systemOnline = (status.online === 1);
                    
                    // Update active devices count based on system status
                    if (systemOnline) {
                        $('#activeSensors').text(devices.sensors.length + devices.actuators.length);
                    } else {
                        $('#activeSensors').text('0');
                    }
                    
                    // Update sensor status in device table
                    devices.sensors.forEach(sensor => {
                        const $row = $(`#deviceTableBody tr[data-device-id="${sensor.id}"][data-device-type="sensor"]`);
                        if ($row.length) {
                            const statusText = systemOnline ? 'Online' : 'Offline';
                            const statusClass = systemOnline ? 'status-online' : 'status-offline';
                            $row.find('td:eq(3)').html(
                                `<span class="status-indicator ${statusClass}"></span> ${statusText}`
                            );
                        }
                    });
                    
                    // Update actuator status in device table
                    devices.actuators.forEach(actuator => {
                        const $row = $(`#deviceTableBody tr[data-device-id="${actuator.id}"][data-device-type="actuator"]`);
                        if ($row.length) {
                            if (!systemOnline) {
                                // When system is offline, show "Offline"
                                $row.find('td:eq(3)').html(
                                    `<span class="status-indicator status-offline"></span> Offline`
                                );
                            } else {
                                // When system is online, show "Ligado" or "Desligado"
                                const statusText = actuator.status === 'Ligado' ? 'Ligado' : 'Desligado';
                                const statusClass = actuator.status === 'Ligado' ? 'status-online' : 'status-offline';
                                $row.find('td:eq(3)').html(
                                    `<span class="status-indicator ${statusClass}"></span> ${statusText}`
                                );
                            }
                        }
                    });
                    
                    // Enable/disable actuator buttons in dashboard
                    if (!systemOnline) {
                        $('.actuator-btn').prop('disabled', true).css('opacity', '0.5').css('cursor', 'not-allowed');
                    } else {
                        $('.actuator-btn').prop('disabled', false).css('opacity', '1').css('cursor', 'pointer');
                    }
                }
            }
        }, (error) => {
            console.error('Erro ao ouvir atualizações de status:', error);
        });
        
        console.log('Listening for real-time sensor updates and status...');
    }

    // Save single device to Firebase (preserves sensor values from Raspberry Pi)
    async function saveDeviceToFirebase(device, deviceType) {
        try {
            const deviceRef = ref(database, `smartcity/devices/${deviceType}/${device.id}`);
            
            const deviceData = {
                id: device.id,
                name: device.name,
                zone: device.zone,
                zoneId: device.zoneId,
                icon: device.icon
            };
            
            // Add type-specific fields
            if (deviceType === 'sensors') {
                deviceData.value = device.value;
            } else {
                deviceData.status = device.status;
            }
            
            await update(deviceRef, deviceData);
            console.log(`${deviceType === 'sensors' ? 'Sensor' : 'Atuador'} ${device.id} salvo no Firebase!`);
        } catch (error) {
            if (error.message.includes('PERMISSION_DENIED') || error.message.includes('Permission denied')) {
                console.warn('Permissões do Firebase não configuradas.');
            } else {
                console.error('Erro ao salvar dispositivo no Firebase:', error);
            }
        }
    }

    // Save all devices to Firebase (use only on initial load or removal)
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
                console.warn('Permissões do Firebase não configuradas. Os dados não serão salvos.');
                console.warn('Configure as regras do Firebase Realtime Database para permitir leitura/escrita.');
            } else {
                console.error('Erro ao salvar dispositivos no Firebase:', error);
            }
        }
    }
    
    // Update only actuator status in Firebase
    async function updateActuatorStatusInFirebase(actuatorId, status) {
        try {
            const statusRef = ref(database, `smartcity/devices/actuators/${actuatorId}/status`);
            await set(statusRef, status);
            console.log(`Status do atuador ${actuatorId} atualizado para ${status}`);
        } catch (error) {
            console.error('Erro ao atualizar status do atuador:', error);
        }
    }
    
    // Load automation rules from Firebase
    async function loadAutomationRules() {
        try {
            const rulesRef = ref(database, 'smartcity/rules');
            const snapshot = await get(rulesRef);
            
            if (snapshot.exists()) {
                automationRules = snapshot.val();
                console.log('Regras carregadas da Firebase:', automationRules);
                
                // Update UI with loaded rules
                updateRulesUI();
            } else {
                console.log('Usando regras padrão');
                saveAutomationRules();
            }
        } catch (error) {
            console.error('Erro ao carregar regras:', error);
        }
    }
    
    // Save automation rules to Firebase
    async function saveAutomationRules() {
        try {
            const rulesRef = ref(database, 'smartcity/rules');
            await set(rulesRef, automationRules);
            console.log('Regras salvas na Firebase');
        } catch (error) {
            console.error('Erro ao salvar regras:', error);
        }
    }
    
    // Update rules UI with current values
    function updateRulesUI() {
        $('#lightThreshold').val(automationRules.lighting.threshold);
        $('#lightThreshold').next('.badge-custom').text(automationRules.lighting.threshold + ' lux');
        $('#rule1').prop('checked', automationRules.lighting.active);
        
        $('input[type="range"]').eq(1).val(automationRules.irrigation.threshold);
        $('input[type="range"]').eq(1).next('.badge-custom').text(automationRules.irrigation.threshold + '%');
        $('#rule2').prop('checked', automationRules.irrigation.active);
        
        // Air quality rule (uses radio buttons for level selection)
        const airLevel = automationRules.airQuality.level || 'moderada';
        $(`input[name="airQualityLevel"][value="${airLevel}"]`).prop('checked', true);
        $('#rule3').prop('checked', automationRules.airQuality.active);
        
        $('input[type="range"]').eq(2).val(automationRules.noise.threshold);
        $('input[type="range"]').eq(2).next('.badge-custom').text(automationRules.noise.threshold + ' dB');
        $('#rule4').prop('checked', automationRules.noise.active);
    }
    
    // Check automation rules when sensor values change
    function checkAutomationRules(sensor) {
        if (!systemOnline) return; // Don't trigger rules if system is offline
        
        // Extract numeric value from sensor.value (remove units)
        const numericValue = parseFloat(sensor.value);
        
        // Check lighting rule
        if (automationRules.lighting.active && sensor.name === automationRules.lighting.type) {
            if (!isNaN(numericValue)) {
                if (numericValue > automationRules.lighting.threshold) {
                    activateActuatorByType(automationRules.lighting.actuator, sensor.zone, 'Ligado');
                } else {
                    activateActuatorByType(automationRules.lighting.actuator, sensor.zone, 'Desligado');
                }
            }
        }
        
        // Check irrigation rule
        if (automationRules.irrigation.active && sensor.name === automationRules.irrigation.type) {
            if (!isNaN(numericValue)) {
                if (numericValue < automationRules.irrigation.threshold) {
                    activateActuatorByType(automationRules.irrigation.actuator, sensor.zone, 'Ligado');
                } else {
                    activateActuatorByType(automationRules.irrigation.actuator, sensor.zone, 'Desligado');
                }
            }
        }
        
        // Check air quality rule (uses text values)
        if (automationRules.airQuality.active && sensor.name === automationRules.airQuality.type) {
            const quality = sensor.value.toString().toLowerCase();
            const selectedLevel = automationRules.airQuality.level || 'moderada';
            
            let shouldActivate = false;
            if (selectedLevel === 'moderada') {
                // Activate for "moderada" or "má"
                shouldActivate = quality.includes('moderada') || quality.includes('má');
            } else if (selectedLevel === 'má') {
                // Activate only for "má"
                shouldActivate = quality.includes('má');
            }
            
            if (shouldActivate) {
                activateActuatorByType(automationRules.airQuality.actuator, sensor.zone, 'Ligado');
            } else {
                activateActuatorByType(automationRules.airQuality.actuator, sensor.zone, 'Desligado');
            }
        }
        
        // Check noise rule
        if (automationRules.noise.active && sensor.name === automationRules.noise.type) {
            if (!isNaN(numericValue)) {
                if (numericValue > automationRules.noise.threshold) {
                    activateActuatorByType(automationRules.noise.actuator, sensor.zone, 'Ligado');
                } else {
                    activateActuatorByType(automationRules.noise.actuator, sensor.zone, 'Desligado');
                }
            }
        }
    }
    
    // Recheck all rules with current sensor values
    function recheckAllRules() {
        console.log('Verificando todas as regras com valores atuais...');
        devices.sensors.forEach(sensor => {
            checkAutomationRules(sensor);
        });
    }
    
    // Activate actuator by type and zone
    function activateActuatorByType(actuatorType, zone, status) {
        const actuator = devices.actuators.find(a => a.name === actuatorType && a.zone === zone);
        
        if (actuator && actuator.status !== status) {
            console.log(`Regra ativada: ${actuatorType} em ${zone} -> ${status}`);
            
            // Update local status
            actuator.status = status;
            
            // Update DOM button
            const $actuatorElement = $(`.sensor-item[data-device-id="${actuator.id}"]`);
            if ($actuatorElement.length) {
                const $btn = $actuatorElement.find('.actuator-btn');
                if (status === 'Ligado') {
                    $btn.addClass('active').removeClass('inactive');
                    $btn.html('<i class="bi bi-toggle-on"></i> Ligado');
                } else {
                    $btn.removeClass('active').addClass('inactive');
                    $btn.html('<i class="bi bi-toggle-off"></i> Desligado');
                }
            }
            
            // Update Firebase
            updateActuatorStatusInFirebase(actuator.id, status);
            
            // Update device table
            updateDeviceTable();
            
            // Update lights count if it's a lighting actuator
            if (actuatorType === 'Iluminação Pública') {
                updateActiveLights();
            }
            
            // Show/hide alerts for pollution actuators
            if (actuatorType.includes('Alertas de Poluição')) {
                if (status === 'Ligado') {
                    const alertType = actuatorType.includes('Sonora') ? 'noise' : 'air';
                    const message = actuatorType.includes('Sonora') 
                        ? 'Nível de ruído acima do limite! Poluição sonora detetada.'
                        : 'Qualidade do ar degradada! Alertas de poluição ativos.';
                    showAlert(alertType, zone, message, actuatorType);
                    
                    // Activate ventilation in Zona Industrial when air pollution alert is active
                    if (!actuatorType.includes('Sonora') && zone === 'Zona Industrial') {
                        const ventilationActuator = devices.actuators.find(a => 
                            a.name === 'Sistema de Ventilação' && a.zone === 'Zona Industrial'
                        );
                        if (ventilationActuator && ventilationActuator.status !== 'Ligado') {
                            console.log('Ativando ventilação na Zona Industrial devido a alerta de poluição');
                            activateActuatorByType('Sistema de Ventilação', 'Zona Industrial', 'Ligado');
                            
                            // Show alert about ventilation activation
                            showVentilationAlert('Zona Industrial', 'Sistema de Ventilação ativado automaticamente devido a má qualidade do ar');
                        }
                    }
                } else {
                    hideAlert(actuatorType);
                    
                    // Deactivate ventilation in Zona Industrial when air pollution alert is turned off
                    if (!actuatorType.includes('Sonora') && zone === 'Zona Industrial') {
                        const ventilationActuator = devices.actuators.find(a => 
                            a.name === 'Sistema de Ventilação' && a.zone === 'Zona Industrial'
                        );
                        if (ventilationActuator && ventilationActuator.status === 'Ligado') {
                            console.log('Desativando ventilação na Zona Industrial - alerta de poluição removido');
                            activateActuatorByType('Sistema de Ventilação', 'Zona Industrial', 'Desligado');
                            
                            // Hide ventilation alert
                            hideVentilationAlert();
                        }
                    }
                }
            }
        }
    }

    // Get icon color class based on sensor/actuator type
    function getIconColorClass(name, icon) {
        // Sensors
        if (name.includes('Temperatura')) return 'text-danger';
        if (name.includes('Humidade')) return 'text-info';
        if (name.includes('Luminosidade')) return 'text-warning';
        if (name.includes('Ruído')) return 'text-dark';
        if (name.includes('Qualidade do Ar')) return 'text-success';
        if (name.includes('CO2')) return 'text-secondary';
        
        // Actuators
        if (name.includes('Iluminação')) return 'text-warning';
        if (name.includes('Rega')) return 'text-info';
        if (name.includes('Câmara')) return 'text-secondary';
        if (name.includes('Ventilação')) return 'text-primary';
        if (name.includes('Poluição') || name.includes('Alerta')) return 'text-warning';
        if (name.includes('Tráfego')) return 'text-danger';
        
        return ''; // Default: no color
    }

    // Add sensor to DOM
    function addSensorToDOM(sensor) {
        const colorClass = getIconColorClass(sensor.name, sensor.icon);
        const iconWithColor = colorClass ? `${sensor.icon} ${colorClass}` : sensor.icon;
        
        const sensorHtml = `
            <div class="sensor-item" data-device-id="${sensor.id}">
                <span class="sensor-name">
                    <i class="${iconWithColor}"></i>
                    ${sensor.name}
                </span>
                <span class="sensor-value">${sensor.value}</span>
            </div>
        `;

        // Find the zone and add sensor
        $('.zone-card').each(function () {
            const cardZone = $(this).find('.zone-title').text().trim();
            if (cardZone === sensor.zone) {
                const actuatorsHeader = $(this).find('h6').filter(function () {
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
        const isActive = actuator.status === 'Ligado';
        const colorClass = getIconColorClass(actuator.name, actuator.icon);
        const iconWithColor = colorClass ? `${actuator.icon} ${colorClass}` : actuator.icon;
        
        const actuatorHtml = `
            <div class="sensor-item" data-device-id="${actuator.id}">
                <span class="sensor-name">
                    <i class="${iconWithColor}"></i>
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
                const actuatorsHeader = $(this).find('h6').filter(function () {
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
    
    // Update average temperature and humidity cards
    function updateAverageValues() {
        // Calculate average temperature
        const temperatureSensors = devices.sensors.filter(s => s.name === 'Temperatura');
        if (temperatureSensors.length > 0) {
            let totalTemp = 0;
            let validCount = 0;
            
            temperatureSensors.forEach(sensor => {
                const numericValue = parseFloat(sensor.value);
                if (!isNaN(numericValue)) {
                    totalTemp += numericValue;
                    validCount++;
                }
            });
            
            if (validCount > 0) {
                const avgTemp = (totalTemp / validCount).toFixed(1);
                $('#avgTemp').text(avgTemp + '°C');
            }
        }
        
        // Calculate average humidity
        const humiditySensors = devices.sensors.filter(s => s.name === 'Humidade');
        if (humiditySensors.length > 0) {
            let totalHumidity = 0;
            let validCount = 0;
            
            humiditySensors.forEach(sensor => {
                const numericValue = parseFloat(sensor.value);
                if (!isNaN(numericValue)) {
                    totalHumidity += numericValue;
                    validCount++;
                }
            });
            
            if (validCount > 0) {
                const avgHumidity = Math.round(totalHumidity / validCount);
                $('#avgHumidity').text(avgHumidity + '%');
            }
        }
        
        // Calculate active lights based on lighting actuators
        updateActiveLights();
    }
    
    // Update active lights count based on public lighting actuators
    function updateActiveLights() {
        const lightingActuators = devices.actuators.filter(a => a.name === 'Iluminação Pública');
        
        // Count how many are active
        const activeLights = lightingActuators.filter(a => a.status === 'Ligado').length;
        
        if (activeLights === 0) {
            // All lights off
            $('#lightsOn').text('0');
        } else {
            // Calculate lights based on number of active zones
            // Each zone has approximately 40-80 lights
            const lightsPerZone = Math.floor(Math.random() * 40) + 40; // Random between 40-80
            const totalLights = activeLights * lightsPerZone;
            $('#lightsOn').text(totalLights);
        }
    }

    // Toggle actuator
    // Alert management functions
    function showAlert(type, zone, message, actuatorName) {
        const alertId = `alert-${actuatorName.replace(/\s+/g, '-')}`;
        
        // Clear existing interval if present
        if (activeAlerts[alertId]) {
            clearInterval(activeAlerts[alertId].interval);
        }
        
        // Function to display/refresh the alert
        function displayAlert() {
            // Only add if not already present
            if ($(`#${alertId}`).length === 0) {
                const iconClass = type === 'air' ? 'bi-wind' : 'bi-volume-up';
                const alertClass = type === 'air' ? 'alert-warning' : 'alert-danger';
                
                const alertHtml = `
                    <div id="${alertId}" class="alert ${alertClass} alert-notification alert-dismissible fade show" role="alert">
                        <i class="bi ${iconClass} me-2"></i>
                        <strong>${zone}</strong> - ${message}
                        <button type="button" class="btn-close"></button>
                    </div>
                `;
                
                $('#alertsContainer').append(alertHtml);
                
                // Add close button handler - only hides, doesn't stop interval
                $(`#${alertId} .btn-close`).on('click', function() {
                    $(`#${alertId}`).fadeOut(300, function() {
                        $(this).remove();
                    });
                });
            }
        }
        
        // Show alert immediately
        displayAlert();
        
        // Set up interval to repeat every 30 seconds
        const intervalId = setInterval(displayAlert, 30000);
        
        // Store alert info
        activeAlerts[alertId] = {
            interval: intervalId,
            type: type,
            zone: zone,
            message: message,
            actuatorName: actuatorName
        };
    }
    
    function hideAlert(actuatorName) {
        const alertId = `alert-${actuatorName.replace(/\s+/g, '-')}`;
        
        // Clear interval
        if (activeAlerts[alertId]) {
            clearInterval(activeAlerts[alertId].interval);
            delete activeAlerts[alertId];
        }
        
        // Remove alert from DOM
        $(`#${alertId}`).fadeOut(300, function() {
            $(this).remove();
        });
    }
    
    function dismissAlert(actuatorName) {
        hideAlert(actuatorName);
    }
    
    // Function to show ventilation alert (informational, one-time)
    function showVentilationAlert(zone, message) {
        const alertId = 'alert-ventilation';
        
        // Remove existing ventilation alert if present
        $(`#${alertId}`).remove();
        
        const alertHtml = `
            <div id="${alertId}" class="alert alert-info alert-notification alert-dismissible fade show" role="alert">
                <i class="bi bi-fan me-2"></i>
                <strong>${zone}</strong> - ${message}
                <button type="button" class="btn-close"></button>
            </div>
        `;
        
        $('#alertsContainer').append(alertHtml);
        
        // Add close button handler
        $(`#${alertId} .btn-close`).on('click', function() {
            $(`#${alertId}`).fadeOut(300, function() {
                $(this).remove();
            });
        });
    }
    
    // Function to hide ventilation alert
    function hideVentilationAlert() {
        const alertId = 'alert-ventilation';
        $(`#${alertId}`).fadeOut(300, function() {
            $(this).remove();
        });
    }

    function toggleActuator(btn) {
        // Check if system is online before allowing toggle
        if (!systemOnline) {
            alert('Sistema offline! Não é possível controlar os atuadores enquanto o Raspberry Pi estiver desligado.');
            return;
        }
        
        const $btn = $(btn);
        const deviceId = $btn.closest('.sensor-item').attr('data-device-id');
        
        // Find the actuator first to check if it's controlled by rules
        const actuator = devices.actuators.find(a => a.id === deviceId);
        if (!actuator) return;
        
        // Check if actuator is controlled by an active automation rule
        const isControlledByRule = 
            (automationRules.lighting.active && actuator.name === automationRules.lighting.actuator) ||
            (automationRules.irrigation.active && actuator.name === automationRules.irrigation.actuator) ||
            (automationRules.airQuality.active && actuator.name === automationRules.airQuality.actuator) ||
            (automationRules.noise.active && actuator.name === automationRules.noise.actuator);
        
        if (isControlledByRule) {
            alert('Este atuador está sob controlo automático!\n\nDesative a regra correspondente na tab "Regras" para controlar manualmente.');
            return;
        }

        let newStatus;
        if ($btn.hasClass('active')) {
            $btn.removeClass('active').addClass('inactive');
            $btn.html('<i class="bi bi-toggle-off"></i> Desligado');
            newStatus = 'Desligado';
        } else {
            $btn.removeClass('inactive').addClass('active');
            $btn.html('<i class="bi bi-toggle-on"></i> Ligado');
            newStatus = 'Ligado';
        }

        // Update status in devices array
        if (deviceId) {
            const actuator = devices.actuators.find(a => a.id === deviceId);
            if (actuator) {
                actuator.status = newStatus;
                // Update status in table with correct status class
                const statusClass = newStatus === 'Ligado' ? 'status-online' : 'status-offline';
                $(`#deviceTableBody tr[data-device-id="${deviceId}"] td:eq(3)`).html(
                    `<span class="status-indicator ${statusClass}"></span> ${newStatus}`
                );

                // Update only the actuator status in Firebase
                updateActuatorStatusInFirebase(deviceId, newStatus);
                
                // Update lights count if it's a lighting actuator
                if (actuator.name === 'Iluminação Pública') {
                    updateActiveLights();
                }
                
                // Show/hide alerts for pollution actuators
                if (actuator.name.includes('Alertas de Poluição')) {
                    if (newStatus === 'Ligado') {
                        const alertType = actuator.name.includes('Sonora') ? 'noise' : 'air';
                        const message = actuator.name.includes('Sonora') 
                            ? 'Nível de ruído acima do limite! Poluição sonora detetada.'
                            : 'Qualidade do ar degradada! Alertas de poluição ativos.';
                        showAlert(alertType, actuator.zone, message, actuator.name);
                    } else {
                        hideAlert(actuator.name);
                    }
                }
            }
        }
    }

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
        
        // Automation rules event listeners
        $('#lightThreshold').on('input', function() {
            const value = $(this).val();
            $(this).next('.badge-custom').text(value + ' lux');
            automationRules.lighting.threshold = parseInt(value);
            saveAutomationRules();
            recheckAllRules(); // Recheck rules immediately
        });
        
        $('#rule1').on('change', function() {
            automationRules.lighting.active = $(this).is(':checked');
            saveAutomationRules();
            recheckAllRules(); // Recheck rules immediately
        });
        
        $('input[type="range"]').eq(1).on('input', function() {
            const value = $(this).val();
            $(this).next('.badge-custom').text(value + '%');
            automationRules.irrigation.threshold = parseInt(value);
            saveAutomationRules();
            recheckAllRules(); // Recheck rules immediately
        });
        
        $('#rule2').on('change', function() {
            automationRules.irrigation.active = $(this).is(':checked');
            saveAutomationRules();
            recheckAllRules(); // Recheck rules immediately
        });
        
        // Air quality rule (radio buttons for level selection)
        $('input[name="airQualityLevel"]').on('change', function() {
            automationRules.airQuality.level = $(this).val();
            saveAutomationRules();
            recheckAllRules(); // Recheck rules immediately
        });
        
        $('#rule3').on('change', function() {
            automationRules.airQuality.active = $(this).is(':checked');
            saveAutomationRules();
            recheckAllRules(); // Recheck rules immediately
        });
        
        // Noise rule slider (now eq(2) since air quality has no slider)
        $('input[type="range"]').eq(2).on('input', function() {
            const value = $(this).val();
            $(this).next('.badge-custom').text(value + ' dB');
            automationRules.noise.threshold = parseInt(value);
            saveAutomationRules();
            recheckAllRules(); // Recheck rules immediately
        });
        
        $('#rule4').on('change', function() {
            automationRules.noise.active = $(this).is(':checked');
            saveAutomationRules();
            recheckAllRules(); // Recheck rules immediately
        });
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
        'Alertas de Poluição': { icon: 'bi bi-exclamation-triangle' },
        'Alertas de Poluição Sonora': { icon: 'bi bi-exclamation-triangle' }
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

        // Check if sensor already exists in this zone
        const existingSensor = devices.sensors.find(s => s.zone === zone && s.name === type);
        if (existingSensor) {
            alert(`Já existe um sensor de ${type} na zona ${zone}!`);
            return;
        }

        const sensorConfig = sensorTypes[type];
        const zoneId = zone.toLowerCase().replace(/\s+/g, '-');
        const randomValue = (Math.random() * 100).toFixed(1);
        const value = randomValue + (sensorConfig.unit ? ' ' + sensorConfig.unit : '');
        const deviceId = generateDeviceId(type, zone);

        // Create sensor element
        const sensorHtml = `
            <div class="sensor-item" data-device-id="${deviceId}">
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
            id: deviceId,
            name: type,
            zone: zone,
            zoneId: zoneId,
            value: value,
            icon: sensorConfig.icon
        });
        updateDeviceTable();
        updateSensorCount();
        updateAverageValues();

        // Save only the new sensor to Firebase
        const newSensor = devices.sensors[devices.sensors.length - 1];
        saveDeviceToFirebase(newSensor, 'sensors');

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

        // Check if actuator already exists in this zone
        const existingActuator = devices.actuators.find(a => a.zone === zone && a.name === type);
        if (existingActuator) {
            alert(`Já existe um atuador de ${type} na zona ${zone}!`);
            return;
        }

        const actuatorConfig = actuatorTypes[type];
        const zoneId = zone.toLowerCase().replace(/\s+/g, '-');
        const deviceId = generateDeviceId(type, zone);

        // Create actuator element
        const actuatorHtml = `
            <div class="sensor-item" data-device-id="${deviceId}">
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
            id: deviceId,
            name: type,
            zone: zone,
            zoneId: zoneId,
            status: 'Desligado',
            icon: actuatorConfig.icon
        });
        updateDeviceTable();
        updateSensorCount();

        // Save only the new actuator to Firebase
        const newActuator = devices.actuators[devices.actuators.length - 1];
        saveDeviceToFirebase(newActuator, 'actuators');

        alert('Atuador adicionado com sucesso!');
    }

    // Update device table
    function updateDeviceTable() {
        const tbody = $('#deviceTableBody');
        tbody.empty();

        // Add sensors
        devices.sensors.forEach(function (sensor) {
            const sensorStatusText = systemOnline ? 'Online' : 'Offline';
            const sensorStatusClass = systemOnline ? 'status-online' : 'status-offline';
            const row = `
                <tr data-device-id="${sensor.id}" data-device-type="sensor">
                    <td>${sensor.zone}</td>
                    <td>${sensor.name}</td>
                    <td><span class="badge-custom bg-info">Sensor</span></td>
                    <td><span class="status-indicator ${sensorStatusClass}"></span> ${sensorStatusText}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="app.removeDevice('${sensor.id}', 'sensor')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });

        // Add actuators
        devices.actuators.forEach(function (actuator) {
            let statusText, statusClass;
            if (!systemOnline) {
                statusText = 'Offline';
                statusClass = 'status-offline';
            } else {
                statusText = actuator.status;
                statusClass = actuator.status === 'Ligado' ? 'status-online' : 'status-offline';
            }
            
            const row = `
                <tr data-device-id="${actuator.id}" data-device-type="actuator">
                    <td>${actuator.zone}</td>
                    <td>${actuator.name}</td>
                    <td><span class="badge-custom bg-success">Atuador</span></td>
                    <td><span class="status-indicator ${statusClass}"></span> ${statusText}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="app.removeDevice('${actuator.id}', 'actuator')">
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
        updateAverageValues();

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
        saveDevicesToFirebase: saveDevicesToFirebase,
        dismissAlert: dismissAlert
    };

})();

// Make functions available globally for inline onclick handlers
window.toggleActuator = function (btn) {
    if (app && app.toggleActuator) {
        app.toggleActuator(btn);
    }
};

window.app = app;
