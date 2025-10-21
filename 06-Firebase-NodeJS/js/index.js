import { database } from './firebase.js';
import { ref, onChildAdded } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Referência para o container de mensagens
const messagesContainer = document.getElementById('messages-container');

// Referência para a coleção 'messages' na base de dados
const messagesRef = ref(database, 'messages');

// Escutar por novas mensagens adicionadas
onChildAdded(messagesRef, (snapshot) => {
    const messageData = snapshot.val();
    
    // Criar o elemento de alerta
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${messageData.type} alert-dismissible fade show`;
    alertDiv.setAttribute('role', 'alert');
    
    // Adicionar o conteúdo da mensagem
    alertDiv.innerHTML = `
        <strong>${messageData.type.toUpperCase()}:</strong> ${messageData.message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Adicionar ao container (no topo para mostrar as mais recentes primeiro)
    messagesContainer.insertBefore(alertDiv, messagesContainer.firstChild);
    
});

console.log('A escutar por novas mensagens...');