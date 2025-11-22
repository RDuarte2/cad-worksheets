var firebase = require('firebase-admin');
var serviceAccount = require('./serviceAccountKey.json');

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://cad2526-2240398-default-rtdb.europe-west1.firebasedatabase.app"
});

firebase.database().ref('/smartcity/sensors/').set({
    value: (20 + Math.random() * 5).toFixed(1),
    dataTime: new Date().toISOString()
});

// Set online status when starting
firebase.database().ref('/smartcity/status').set({
    online: 1,
    lastUpdate: new Date().toISOString()
});

function simulateDataUpdate() {
    // Temperatura Centro Histórico
    firebase.database().ref('/smartcity/devices/sensors/Temperatura_CentroHistórico').update({
        value: (20 + Math.random() * 5).toFixed(1) + ' °C',
        dataTime: new Date().toISOString(),
    });

    // Temperatura Parque Verde
    firebase.database().ref('/smartcity/devices/sensors/Temperatura_ParqueVerde').update({
        value: (20 + Math.random() * 5).toFixed(1) + ' °C',
        dataTime: new Date().toISOString(),
    });

    // Temperatura Zona Industrial
    firebase.database().ref('/smartcity/devices/sensors/Temperatura_ZonaIndustrial').update({
        value: (20 + Math.random() * 5).toFixed(1) + ' °C',
        dataTime: new Date().toISOString(),
    });

    // Temperatura Zona Residencial
    firebase.database().ref('/smartcity/devices/sensors/Temperatura_ZonaResidencial').update({
        value: (20 + Math.random() * 5).toFixed(1) + ' °C',
        dataTime: new Date().toISOString(),
    });

    // Humidade Centro Historico
    firebase.database().ref('/smartcity/devices/sensors/Humidade_CentroHistorico').update({
        value: (60 + Math.random() * 15).toFixed(1) + ' %',
        dataTime: new Date().toISOString(),
    });

    // Humidade Zona Residencial
    firebase.database().ref('/smartcity/devices/sensors/Humidade_ZonaResidencial').update({
        value: (60 + Math.random() * 15).toFixed(1) + ' %',
        dataTime: new Date().toISOString(),
    });

    // Luminosidade Centro Historico
    firebase.database().ref('/smartcity/devices/sensors/Luminosidade_CentroHistorico').update({
        value: (300 + Math.random() * 200).toFixed(1) + ' lux',
        dataTime: new Date().toISOString(),
    });

    // Luminosidade Parque Verde
    firebase.database().ref('/smartcity/devices/sensors/Luminosidade_ParqueVerde').update({
        value: (300 + Math.random() * 200).toFixed(1) + ' lux',
        dataTime: new Date().toISOString(),
    });
    
    // Luminosidade Zona Residencial
    firebase.database().ref('/smartcity/devices/sensors/Luminosidade_ZonaResidencial').update({
        value: (300 + Math.random() * 200).toFixed(1) + ' lux',
        dataTime: new Date().toISOString(),
    });

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


// firebase.database().ref('/sensors/sensor1')
//     .on('value', function (snapshot) {
//         if (snapshot.exists()) {
//             console.log(snapshot.val().value);
//         }
//     });