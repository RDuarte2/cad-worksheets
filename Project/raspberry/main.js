var firebase = require('firebase-admin');
var serviceAccount = require('./serviceAccountKey.json');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// GPIO Configuration (BCM numbering)
const gpioConfig = {
    'IluminacaoPublica_CentroHistorico': 17,
    'IluminacaoPublica_ParqueVerde': 27,
    'IluminacaoPublica_ZonaResidencial': 22,
    'SistemadeVentilacao_ZonaIndustrial': 23
};

// Initialize GPIOs with pinctrl
async function initializeGPIOs() {
    console.log('Inicializando GPIOs com pinctrl...');
    
    for (const [key, pin] of Object.entries(gpioConfig)) {
        try {
            // Disable any pull up/down resistors first
            await execPromise(`pinctrl set ${pin} no`);
            // Set pin as output
            await execPromise(`pinctrl set ${pin} op`);
            // Set to LOW initially
            await execPromise(`pinctrl set ${pin} dl`);
            console.log(`GPIO ${pin} inicializado: ${key}`);
        } catch (err) {
            console.error(`Erro ao inicializar GPIO ${pin} (${key}):`, err.message);
        }
    }
    
    console.log('Todos os GPIOs inicializados!');
    initializeFirebase();
}

// Write to GPIO
async function writeGPIO(pin, value) {
    try {
        const level = value ? 'dh' : 'dl'; // dh = drive high, dl = drive low
        await execPromise(`pinctrl set ${pin} ${level}`);
        return true;
    } catch (err) {
        console.error(`Erro ao escrever no GPIO ${pin}:`, err.message);
        return false;
    }
}

// Start initialization
initializeGPIOs();

function initializeFirebase() {
    firebase.initializeApp({
        credential: firebase.credential.cert(serviceAccount),
        databaseURL: "https://cad2526-2240398-default-rtdb.europe-west1.firebasedatabase.app"
    });

    // Listen for actuator changes in Firebase
    firebase.database().ref('/smartcity/devices/actuators').on('value', (snapshot) => {
        if (snapshot.exists()) {
            const actuators = snapshot.val();

            Object.keys(actuators).forEach(async actuatorKey => {
                const actuator = actuators[actuatorKey];

                // Check if this actuator has a GPIO mapping
                if (gpioConfig[actuatorKey]) {
                    const isOn = actuator.status === 'Ligado' || actuator.status === 'Ativo';
                    
                    if (await writeGPIO(gpioConfig[actuatorKey], isOn)) {
                        console.log(`${actuatorKey}: ${isOn ? 'ON' : 'OFF'}`);
                    }
                }
            });
        }
    });

    console.log('Sistema iniciado - Escutando mudanças nos atuadores...');

    // Set online status when starting
    firebase.database().ref('/smartcity/status').set({
        online: 1,
        lastUpdate: new Date().toISOString()
    });

    function simulateDataUpdate() {
        // Update status to show it's still running
        firebase.database().ref('/smartcity/status').update({
            lastUpdate: new Date().toISOString()
        });
    }
    setInterval(simulateDataUpdate, 5000);

    // Handle graceful shutdown
    async function shutdown(signal) {
        console.log(`\n${signal} recebido. Desligando sistema...`);

        try {
            // Turn off all GPIOs before shutdown
            for (const [key, pin] of Object.entries(gpioConfig)) {
                await writeGPIO(pin, false);
            }
            console.log('GPIOs desativados');

            // Set offline status before exiting
            await firebase.database().ref('/smartcity/status').set({
                online: 0,
                lastUpdate: new Date().toISOString()
            });

            console.log('Status atualizado - Sistema OFFLINE');
            process.exit(0);
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            process.exit(1);
        }
    }

    // Listen for termination signals
    process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
    process.on('SIGTERM', () => shutdown('SIGTERM')); // Kill command
    process.on('exit', () => {
        console.log('Processo terminado');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('Erro não tratado:', error);
        shutdown('UNCAUGHT_EXCEPTION');
    });
}
