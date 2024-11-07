// main.js
import { auth, signIn, signUp, isAuthenticated, logout } from './auth.js';
import { state, elements, fillCanvasWithWhite, fetchPixels, sendPixelData, drawPixel, getPixelCoordinates } from './canvas.js';
import { socket, initWebSocket } from './websocket.js';
import { elements as uiElements, showError, openForm, initAfterLogin, clearFormFields, checkAuthentication } from './ui.js';

// Инициализация
function initializeApp() {
  fillCanvasWithWhite();
  fetchPixels();
  checkAuthentication(); // Проверяем авторизацию при загрузке страницы
  if (auth.token) initAfterLogin();
}

// Запуск приложения
window.addEventListener("load", initializeApp);

