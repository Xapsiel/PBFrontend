// websocket.js
import { auth } from './auth.js';
import { fetchPixels, drawPixel, drawBufferToCanvas } from './canvas.js';

let socket = null;

// Инициализация WebSocket
function initWebSocket() {
    socket = new WebSocket(`ws://localhost:8080/webhook/ws?token=${auth.token}`);
    socket.onopen = fetchPixels;
    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        drawPixel(data.x, data.y, data.color);
        drawBufferToCanvas()
    };
    socket.onclose = () => setTimeout(initWebSocket, 2000);
}

export { socket, initWebSocket };