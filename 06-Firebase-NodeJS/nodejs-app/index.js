// Importar o Firebase Admin SDK
const admin = require('firebase-admin');

// Importar o ficheiro de credenciais
// IMPORTANTE: Substitui 'serviceAccountKey.json' pelo nome do teu ficheiro
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar o Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cad2526-2240398-default-rtdb.europe-west1.firebasedatabase.app"
});

// Obter referência para a base de dados
const db = admin.database();
const messagesRef = db.ref('messages');

// Arrays com frases e tipos de mensagens aleatórias
const messages = [
  "A aplicação está a funcionar corretamente!",
  "Nova mensagem recebida do servidor.",
  "Sistema operacional sem problemas.",
  "Atenção: Verificar configurações.",
  "Alerta: Monitorização ativa.",
  "Tudo OK por aqui!",
  "Firebase Realtime Database em funcionamento.",
  "Node.js a enviar mensagens automaticamente.",
  "Comunicação estabelecida com sucesso.",
  "Teste de conectividade concluído."
];

const types = ['success', 'warning', 'danger', 'primary'];

// Função para obter uma mensagem aleatória
function getRandomMessage() {
  return messages[Math.floor(Math.random() * messages.length)];
}

// Função para obter um tipo aleatório
function getRandomType() {
  return types[Math.floor(Math.random() * types.length)];
}

// Função para enviar uma mensagem para o Firebase
function sendMessage() {
  const newMessage = {
    message: getRandomMessage(),
    type: getRandomType(),
    timestamp: Date.now()
  };

  // Push da mensagem para o Firebase
  messagesRef.push(newMessage)
    .then(() => {
      console.log(`Mensagem enviada: [${newMessage.type}] ${newMessage.message}`);
    })
    .catch((error) => {
      console.error('Erro ao enviar mensagem:', error);
    });
}

// Enviar uma mensagem inicial
console.log('Node.js App iniciada. A enviar mensagens a cada 5 segundos...');
sendMessage();

// Enviar mensagens a cada 5 segundos
setInterval(sendMessage, 5000);