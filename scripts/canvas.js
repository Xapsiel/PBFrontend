import { auth } from './auth.js';
import { showError } from './ui.js';
import { getLastClickFromServer, isAuthenticated } from './auth.js';
import { socket } from './websocket.js';

const pixelSize = 10;
const cooldownTime = 10000;
const initialCanvasSize = 500;
const numPixels = 50;
const maxZoom = 5
const minZoom = 0.5
const canvas = document.getElementById('pixelCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let resizeTimeout;
window.onresize = () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    fetchPixels();
  }, 100);
};

const state = {
  isDrawing: false,
  lastSendTime: 0,
  prevCoords: { x: 0, y: 0 },
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isPanning: false, // Для отслеживания перемещения полотна
  startPan: { x: 0, y: 0 }, // Начальная позиция для перемещения
};

const elements = {
  canvas: document.getElementById('pixelCanvas'),
  ctx: document.getElementById('pixelCanvas').getContext('2d'),
  coordinates: document.getElementById("coordinateDisplay"),
};

// Создаем буферный канвас
const bufferCanvas = document.createElement('canvas');
bufferCanvas.width = numPixels * pixelSize;
bufferCanvas.height = numPixels * pixelSize;
const bufferCtx = bufferCanvas.getContext('2d');

function fillCanvasWithWhite() {
  const cols = numPixels;
  const rows = numPixels;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      drawPixel(x, y, '#FFFFFF');
    }
  }
}

async function fetchPixels() {
  bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
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
  drawBufferToCanvas();
}

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

function drawPixel(x, y, color) {
  bufferCtx.fillStyle = color;
  bufferCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
}

function drawBufferToCanvas() {
  elements.ctx.clearRect(0, 0, canvas.width, canvas.height);
  elements.ctx.drawImage(
    bufferCanvas,
    state.offsetX,
    state.offsetY,
    bufferCanvas.width * state.scale,
    bufferCanvas.height * state.scale
  );
}

function getPixelCoordinates(event) {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - rect.left - state.offsetX) / (pixelSize * state.scale)),
    y: Math.floor((event.clientY - rect.top - state.offsetY) / (pixelSize * state.scale)),
  };
}

elements.canvas.addEventListener('mousedown', async (event) => {
  if (event.button === 0) {
    // Левая кнопка мыши — ставим пиксель
    if (!await isAuthenticated()) {
      showError("Вы должны быть авторизованы, чтобы ставить пиксели.");
      return;
    }
    state.isDrawing = true;
    const { x, y } = getPixelCoordinates(event);
    const color = document.querySelector('input[name="color"]:checked').value;
    if (await sendPixelData(x, y, color)) drawPixel(x, y, color);
    drawBufferToCanvas();
  } else if (event.button === 2) {
    // Правая кнопка мыши — начало перемещения
    state.isPanning = true;
    state.startPan = { x: event.clientX, y: event.clientY };
  }
});

elements.canvas.addEventListener('mousemove', (event) => {
  const { x, y } = getPixelCoordinates(event);
  if (x !== state.prevCoords.x || y !== state.prevCoords.y) {
    elements.coordinates.textContent = `x: ${x}, y: ${y}`;
    state.prevCoords = { x, y };
  }

  if (state.isPanning) {
    // Обновление смещения при перемещении
    state.offsetX += event.clientX - state.startPan.x;
    state.offsetY += event.clientY - state.startPan.y;
    state.startPan = { x: event.clientX, y: event.clientY };

    // Перерисовка полотна
    drawBufferToCanvas();
  }
});

elements.canvas.addEventListener('mouseup', () => {
  state.isDrawing = false;
  state.isPanning = false;
});

// Добавляем зум к положению курсора
elements.canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const zoomFactor = 1.1;
  const mouseX = event.clientX - canvas.getBoundingClientRect().left;
  const mouseY = event.clientY - canvas.getBoundingClientRect().top;

  const oldScale = state.scale;
  const newScale = event.deltaY < 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
  if (maxZoom<newScale){
    newScale = oldScale;
  }else if (minZoom > newScale){
    newScale = oldScale
  }
  // Вычисляем новое смещение, чтобы зумировать к позиции курсора
  state.offsetX = mouseX - ((mouseX - state.offsetX) * newScale / oldScale);
  state.offsetY = mouseY - ((mouseY - state.offsetY) * newScale / oldScale);
  
  state.scale = newScale;

  // Перерисовываем пиксели
  drawBufferToCanvas();
});

// Отключаем контекстное меню, чтобы правая кнопка мыши работала для перемещения
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

export { state, elements, fillCanvasWithWhite, fetchPixels, sendPixelData, drawPixel, getPixelCoordinates,drawBufferToCanvas };