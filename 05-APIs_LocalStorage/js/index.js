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
                localStorage.setItem('musicButton', 'on');
                localStorage.setItem('TimeButtonChangeMusic', new Date().toISOString());
                document.getElementById('TimeLivingRoomMusic').textContent = localStorage.getItem('TimeButtonChangeMusic');
            } else {
                icon.className = 'fa-solid fa-volume-xmark';
                icon.style.color = 'red';
                localStorage.setItem('musicButton', 'off');
                localStorage.setItem('TimeButtonChangeMusic', new Date().toISOString());
                document.getElementById('TimeLivingRoomMusic').textContent = localStorage.getItem('TimeButtonChangeMusic');
            }
        });
    }

    changeMusicIcon(musicButton, musicIcon);

    function toggleLight(button, icon) {
        button.addEventListener('change', function () {
            if (button.checked) {
                icon.style.color = 'yellow';
                localStorage.setItem(button.id, 'on');
                localStorage.setItem('Time' + button.id, new Date().toISOString());
                document.getElementById('Time' + button.id).textContent = localStorage.getItem('Time' + button.id);
            } else {
                icon.style.color = 'black';
                localStorage.setItem(button.id, 'off');
                localStorage.setItem('Time' + button.id, new Date().toISOString());
                document.getElementById('Time' + button.id).textContent = localStorage.getItem('Time' + button.id);
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

        // Restore light states from localStorage
        const buttons = [
            { button: btnLightKitchen, icon: iconLightKitchen },
            { button: btnCeilingLightLivingRoom, icon: iconCeilingLightLivingRoom },
            { button: btnAmbientLightLivingRoom, icon: iconAmbientLightLivingRoom }
        ];

        buttons.forEach(({button, icon}) => {
            const savedState = localStorage.getItem(button.id);
            if (savedState === 'on') {
                button.checked = true;
                icon.style.color = 'yellow';
            } else if (savedState === 'off') {
                button.checked = false;
                icon.style.color = 'black';
            }
            // Display last change time if available
            const timeElement = document.getElementById('Time' + button.id);
            const savedTime = localStorage.getItem('Time' + button.id);
            if (timeElement && savedTime) {
                timeElement.textContent = savedTime;
            }
        });
        
        // Restore music state from localStorage
        const timeMusicElement = document.getElementById('TimeButtonChangeMusic');
        const savedMusicTime = localStorage.getItem('TimeButtonChangeMusic');
        const savedMusicState = localStorage.getItem('musicButton');
        if (savedMusicState === 'on') {
            musicButton.checked = true;
            musicIcon.className = 'fa-solid fa-music';
            musicIcon.style.color = 'blue';
        } else if (savedMusicState === 'off') {
            musicButton.checked = false;
            musicIcon.className = 'fa-solid fa-volume-xmark';
            musicIcon.style.color = 'red';
        }

        // Display last change time if available
        if (timeMusicElement && savedMusicTime) {
            timeMusicElement.textContent = savedMusicTime;
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

    // Function to update the last update time
    var lastUpdateTime = null;
    var updateTimeInterval = null;

    function updateLastUpdateTime() {
        if (!lastUpdateTime) return;

        const now = new Date();
        const diffInSeconds = Math.floor((now - lastUpdateTime) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);

        let timeText;
        if (diffInSeconds < 60) {
            timeText = diffInSeconds + ' seconds ago';
        } else if (diffInMinutes < 60) {
            timeText = diffInMinutes + ' minutes ago';
        } else {
            timeText = diffInHours + ' hours ago';
        }

        $('#lastUpdate').text(timeText);
    }

    // Weather API functionality
    $(document).ready(function () {
        $('#getWeatherBtn').on('click', function () {
            var city = $('.form-control').val() || 'Leiria';
            var apiUrl = 'https://api.openweathermap.org/data/2.5/weather?units=metric&q=' + city + '&appid=c00bd5f16b4fb9f6f6dcbe3cabdf9828';

            $.ajax({
                url: apiUrl,
                dataType: 'json'
            })
                .done(function (weather) {
                    // Update current temperature
                    $('#curTemperature').text(weather.main.temp.toFixed(1) + ' °C');

                    // Update max temperature
                    $('#maxTemperature').text(weather.main.temp_max.toFixed(1) + ' °C');

                    // Update min temperature
                    $('#minTemperature').text(weather.main.temp_min.toFixed(1) + ' °C');

                    // Update humidity
                    $('#humidity').text(weather.main.humidity + '%');

                    // Convert sunrise time
                    var sunriseTime = new Date(weather.sys.sunrise * 1000);
                    var sunriseHours = sunriseTime.getHours();
                    var sunriseMinutes = String(sunriseTime.getMinutes()).padStart(2, '0');
                    $('#sunriseTime').text(sunriseHours + 'h' + sunriseMinutes);

                    // Convert sunset time
                    var sunsetTime = new Date(weather.sys.sunset * 1000);
                    var sunsetHours = sunsetTime.getHours();
                    var sunsetMinutes = String(sunsetTime.getMinutes()).padStart(2, '0');
                    $('#sunsetTime').text(sunsetHours + 'h' + sunsetMinutes);

                    // Update last update time
                    lastUpdateTime = new Date();
                    updateLastUpdateTime();

                    // Clear existing interval if any
                    if (updateTimeInterval) {
                        clearInterval(updateTimeInterval);
                    }

                    // Start new interval
                    updateTimeInterval = setInterval(updateLastUpdateTime, 1000);

                })
                .fail(function (jqXHR, textStatus, error) {
                    console.error('Error:', error);  // Debug line
                    alert('Error fetching weather data: ' + error);
                });
        });
    });

})();
