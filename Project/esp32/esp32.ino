#include <WiFi.h>
#include <FirebaseESP32.h>
#include "DHT.h"
#include "time.h"

// --- Configurações ---
#define WIFI_SSID "iPhone de Rodrigo"
#define WIFI_PASSWORD "rodrigoduarte"
#define FIREBASE_HOST "cad2526-2240398-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "iQ8C0b750r2ZSOpe6XDniDDi5ZDZZaKOcrq2CUHI"

// --- Pinos ---
#define PIN_DHT 4    
#define PIN_LDR 34  

#define DHTTYPE DHT11
DHT dht(PIN_DHT, DHTTYPE);

// --- Hora (NTP) ---
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 0;
const int   daylightOffset_sec = 3600;

FirebaseData firebaseData;
FirebaseConfig config;
FirebaseAuth auth;
FirebaseJson json;

// --- LISTA DE OPÇÕES PARA QUALIDADE DO AR ---
String opcoesAr[] = {"Má", "Moderada", "Excelente"};

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(PIN_LDR, INPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  Serial.println("Wi-Fi Ligado!");

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

String getISOTime() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){ return "Time Error"; }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(timeStringBuff);
}

void atualizarSensor(String nomeDoSensor, String valorFormatado, int status) {
  json.clear();
  json.set("sensorStatus", status);

  if (status == 1) {
    json.set("value", valorFormatado);
    json.set("dataTime", getISOTime());
  } 

  String caminhoCompleto = "/smartcity/devices/sensors/" + nomeDoSensor;

  if (Firebase.updateNode(firebaseData, caminhoCompleto, json)) {
      Serial.print(" > "); Serial.println(nomeDoSensor);
  } else {
      Serial.print("ERRO envio: "); Serial.println(firebaseData.errorReason());
  }
}

void loop() {
  // --- VERIFICAR SE O SISTEMA ESTÁ ONLINE ---
  int sistemaOnline = 0; 

  if (Firebase.getInt(firebaseData, "/smartcity/status/online")) {
    if (firebaseData.dataType() == "int") {
      sistemaOnline = firebaseData.intData();
    }
  } else {
    Serial.print("Erro leitura status: ");
    Serial.println(firebaseData.errorReason());
  }

  if (sistemaOnline == 0) {
    Serial.println("--- SISTEMA EM PAUSA (Remoto: 0) ---");
    delay(5000); 
    return; 
  }
  
  // --- Leitura dos Sensores Físicos ---
  float tempReal = dht.readTemperature();
  float humReal = dht.readHumidity();
  int luzRaw = analogRead(PIN_LDR);
  float luzReal = map(luzRaw, 0, 4095, 0, 1000); 
  
  // Verificação de Erros Físicos
  int statusDHT = (isnan(tempReal) || isnan(humReal)) ? 0 : 1;
  int statusLDR = (luzRaw == 0) ? 0 : 1;

  // --- Simulação e Cálculos ---
  float jitter = (random(-5, 5) / 10.0);
  
  // Geração de valores aleatórios para os sensores virtuais
  // Humidade do Solo: Entre 40% e 80%
  int humSolo = random(40, 81); 
  
  // Ruído (dB): Valores diferentes consoante a zona
  int ruidoCentro = random(50, 75); // Zona movimentada (50-75 dB)
  int ruidoInd = random(65, 95);    // Zona barulhenta (65-95 dB)
  int ruidoRes = random(30, 50);    // Zona calma (30-50 dB)

  // CO2 Zona Industrial (PPM)
  // Entre 500 (fim de semana/vento) e 1600 (pico de trabalho)
  int co2Ind = random(500, 1600);

  // O texto reflete o CO2 simulado
  String arIndustrial;
  if (co2Ind < 800) {
    arIndustrial = "Excelente";
  } else if (co2Ind < 1200) {
    arIndustrial = "Moderada";
  } else {
    arIndustrial = "Má";
  }

  // Qualidade do ar: random(0, 3) gera 0, 1 ou 2. Usa-se esse número para ir buscar a string à lista.
  String arParqueVerde = opcoesAr[random(0, 3)];

  // Status dos virtuais é sempre 1 pois são gerados por software
  int statusVirtual = 1; 

  Serial.println("--- A enviar dados (SISTEMA ONLINE) ---");

  // --- ENVIO ---

  // Temperatura
  atualizarSensor("Temperatura_CentroHistorico", String(tempReal, 1) + " C", statusDHT);
  atualizarSensor("Temperatura_ParqueVerde", String(tempReal - 1.5 + jitter, 1) + " C", statusDHT);
  atualizarSensor("Temperatura_ZonaIndustrial", String(tempReal + 2.0 + jitter, 1) + " C", statusDHT);
  atualizarSensor("Temperatura_ZonaResidencial", String(tempReal + 0.5 + jitter, 1) + " C", statusDHT);

  // Humidade Ar
  atualizarSensor("Humidade_CentroHistorico", String(humReal, 1) + " %", statusDHT);
  atualizarSensor("Humidade_ZonaResidencial", String(humReal + jitter, 1) + " %", statusDHT);

  // Luminosidade
  atualizarSensor("Luminosidade_CentroHistorico", String(luzReal, 0) + " lux", statusLDR);
  atualizarSensor("Luminosidade_ParqueVerde", String(luzReal - 50 + (jitter*10), 0) + " lux", statusLDR);
  atualizarSensor("Luminosidade_ZonaResidencial", String(luzReal + 20 + (jitter*10), 0) + " lux", statusLDR);

  // --- SENSORES SIMULADOS ---
  
  // Humidade do Solo
  atualizarSensor("HumidadedoSolo_ParqueVerde", String(humSolo) + " %", statusVirtual);

  // Ruído
  atualizarSensor("Ruido_CentroHistorico", String(ruidoCentro) + " dB", statusVirtual);
  atualizarSensor("Ruido_ZonaIndustrial", String(ruidoInd) + " dB", statusVirtual);
  atualizarSensor("Ruido_ZonaResidencial", String(ruidoRes) + " dB", statusVirtual);

  // Qualidade do Ar
  atualizarSensor("QualidadedoAr_ZonaIndustrial", String(arIndustrial), statusVirtual);
  atualizarSensor("QualidadedoAr_ParqueVerde", String(arParqueVerde), statusVirtual);

  // CO2
  atualizarSensor("CO2_ZonaIndustrial", String(co2Ind) + " ppm", statusVirtual);

  Serial.println("--- Ciclo terminado. Pausa de 5s ---");
  delay(5000);
}