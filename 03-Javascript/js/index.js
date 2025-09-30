var app = (function () {
    'use strict';
    // Your code goes here!
    const btnLightKitchen = document.getElementById('lightButton_Kitchen');
    const iconLightKitchen = document.getElementById('lightKitchen');
    const btnCeilingLightLivingRoom = document.getElementById('lightButton1_LivingRoom');
    const iconCeilingLightLivingRoom = document.getElementById('ceilingLightLivingRoom');
    const btnAmbientLightLivingRoom = document.getElementById('lightButton2_LivingRoom');
    const iconAmbientLightLivingRoom = document.getElementById('ambientLightLivingRoom');
    const musicButton = document.getElementById('musicButton');
    const musicIcon = document.getElementById('musicIcon');

    function changeMusicIcon(button, icon) {
        button.addEventListener('change', function () {
            if (button.checked) {
                icon.className = 'fa-solid fa-music';
                icon.style.color = 'blue';
            } else {
                icon.className = 'fa-solid fa-volume-xmark';
                icon.style.color = 'red';
            }
        });
    }

    changeMusicIcon(musicButton, musicIcon);

    function toggleLight(button, icon) {
        button.addEventListener('change', function () {
            if (button.checked) {
                icon.style.color = 'yellow';
            } else {
                icon.style.color = 'black';
            }
        });
    }

    toggleLight(btnLightKitchen, iconLightKitchen);
    toggleLight(btnCeilingLightLivingRoom, iconCeilingLightLivingRoom);
    toggleLight(btnAmbientLightLivingRoom, iconAmbientLightLivingRoom);

    window.addEventListener('DOMContentLoaded', function () {
        var dateElement = document.getElementById('date');
        if (dateElement) {
            var today = new Date();
            var day = String(today.getDate()).padStart(2, '0');
            var month = String(today.getMonth() + 1).padStart(2, '0');
            var year = today.getFullYear();
            var formattedDate = year + '-' + month + '-' + day;
            dateElement.textContent = formattedDate;
        }
    });

    var updateClock = function () {
        var timeElement = document.getElementById('time');
        var now = new Date();
        var hours = now.getHours();
        var minutes = now.getMinutes();
        var seconds = now.getSeconds();
        timeElement.textContent = hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }; var clockInterval = setInterval(updateClock, 1000);

    var updateTemperature = function () {
        var kitchenTemperatureElement = document.getElementById('temperatureKitchen');
        var livingRoomTemperatureElement = document.getElementById('temperatureLivingRoom');

        kitchenTemperatureElement.textContent = (Math.random() * 20 + 10).toFixed(1) + ' °C';
        livingRoomTemperatureElement.textContent = (Math.random() * 20 + 10).toFixed(1) + ' °C';
    }; var temperatureInterval = setInterval(updateTemperature, 5000);


})();
