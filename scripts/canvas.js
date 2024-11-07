import { auth } from './auth.js';
import { showError } from './ui.js';
import { getLastClickFromServer, isAuthenticated } from './auth.js';
import { socket } from './websocket.js';

const pixelSize = 10;
const cooldownTime = 10000;
const initialCanvasSize = 500; // Начальный размер канваса
const numPixels = 50; // Количество пикселей (50x50)

const state = {
    isDrawing: false,
    lastSendTime: 0,
    prevCoords: { x: 0, y: 0 },
    scale: 1, // Начальный масштаб
    offsetX: 0, // Смещение по X
    offsetY: 0, // Смещение по Y
};

const elements = {
    canvas: document.getElementById('pixelCanvas'),
    ctx: document.getElementById('pixelCanvas').getContext('2d'),
    coordinates: document.getElementById("coordinateDisplay"),
};

// Заполнение белым цветом
function fillCanvasWithWhite() {
    const cols = numPixels;
    const rows = numPixels;
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            drawPixel(x, y, '#FFFFFF');
        }
    }
}

// Получение и рисование пикселей
async function fetchPixels() {
    fillCanvasWithWhite();
    try {
        const response = await axios.get('http://localhost:8080/pixels/getPixels', {
            headers: {
                "Authorization": `Bearer ${auth.token}`,
                "Content-Type": "application/json; charset=UTF-8",
            },
        });
        response.data.forEach(pixel => drawPixel(pixel.x, pixel.y, pixel.color));
    } catch (error) {
        console.error('Error fetching pixels:', error);
        throw error;
    }
}

// Отправка пикселя
async function sendPixelData(x, y, color) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.error("WebSocket не инициализирован или не подключен.");
        return false;
    }
    state.lastSendTime = await getLastClickFromServer();
    const currentTime = Date.now();
    if (currentTime - state.lastSendTime < cooldownTime) {
        showError("Кулдаун не прошел");
        return false;
    }

    const pixelData = { x, y, color, lastclick: currentTime, id: parseInt(auth.id) };
    socket.send(JSON.stringify(pixelData));
    return true;
}

// Рисование пикселя
function drawPixel(x, y, color) {
    elements.ctx.fillStyle = color;
    elements.ctx.fillRect(x * pixelSize * state.scale + state.offsetX, y * pixelSize * state.scale + state.offsetY, pixelSize * state.scale, pixelSize * state.scale);
}

// Получение координат пикселя
function getPixelCoordinates(event) {
    const rect = elements.canvas.getBoundingClientRect();
    return {
        x: Math.floor((event.clientX - rect.left - state.offsetX) / (pixelSize * state.scale)),
        y: Math.floor((event.clientY - rect.top - state.offsetY) / (pixelSize * state.scale)),
    };
}

// Обработка событий
elements.canvas.addEventListener('mousedown', async (event) => {
    if (!await isAuthenticated()) {
        showError("Вы должны быть авторизованы, чтобы ставить пиксели.");
        return;
    }
    state.isDrawing = true;
    const { x, y } = getPixelCoordinates(event);
    const color = document.querySelector('input[name="color"]:checked').value;
    if (await sendPixelData(x, y, color)) drawPixel(x, y, color);
});

elements.canvas.addEventListener('mousemove', (event) => {
    const { x, y } = getPixelCoordinates(event);
    if (x !== state.prevCoords.x || y !== state.prevCoords.y) {
        elements.coordinates.textContent = `x: ${x}, y: ${y}`;
        state.prevCoords = { x, y };
    }
});



elements.canvas.addEventListener('mouseup', () => state.isDrawing = false);

export { state, elements, fillCanvasWithWhite, fetchPixels, sendPixelData, drawPixel, getPixelCoordinates };