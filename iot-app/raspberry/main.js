var firebase = require('firebase-admin');
var serviceAccount = require('./serviceAccountKey.json');

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://cad2526-2240398-default-rtdb.europe-west1.firebasedatabase.app"
});

firebase.database().ref('/sensors/sensor1').set({
    value: 10,
    dataTime: new Date().toISOString()
});

firebase.database().ref('/sensors/sensor1')
    .on('value', function (snapshot) {
        if (snapshot.exists()) {
            console.log(snapshot.val().value);
        }
    });