const login = "ilya2s";
const email = "ilyas2@mail2";
const password = "2password";
const repeatPassword = "2password";

const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const pixelSize = 10; // Размер пикселя
let isDrawing = false;
let socket = null; // WebSocket переменная
let lastSendTime = 0; // Время последней отправки
const cooldownTime = 10000; // Кулдаун 10 секунд
let prevX = -1;
let prevY = -1;
let prevColor = "#0ff000";

// Функция для входа
async function signIn(login, password) {
  try {
    const response = await axios.post("http://localhost:8080/SignIn", {
      login,
      password,
    });
    if (response.data.token) {
      const jwtToken = response.data.token;
      const id = response.data.id;
      window.localStorage.setItem("jwtToken", jwtToken);
      window.localStorage.setItem("id", id);
      console.log("User ID:", id);
      return jwtToken;
    } else {
      throw new Error("No token received during sign-in.");
    }
  } catch (error) {
    console.error("Error during SignIn:", error);
    throw error;
  }
}

// Функция для регистрации
async function signUp(login, email, password, repeatPassword) {
  try {
    const response = await axios.post("http://localhost:8080/SignUp", {
      login,
      email,
      password,
      repeatpassword: repeatPassword,
    });
    console.log("Sign-up response:", response.data);
    if (response.data.status === "success") {
      await signIn(login, password); // Вход после успешной регистрации
    }
    return response.data
  } catch (error) {
    console.error("Error during SignUp:", error);
    throw error;
  }
}

// Получение времени последнего клика с сервера
async function getLastClickFromServer() {
  try {
    const id = parseInt(window.localStorage.getItem("id"));
    console.log("Fetching last click for user ID:", id);
    const response = await axios.post('http://localhost:8080/getLastClick', {
      id,
    }, {
      headers: {
        "Authorization": `Bearer ${window.localStorage.getItem("jwtToken")}`,
      },
    });

    console.log("Last click received from server:", response.data.lastclick);
    return response.data.lastclick;
  } catch (error) {
    console.error("Error fetching last click from server:", error);
    throw error;
  }
}

// Функция для закрашивания всех пикселей в белый цвет
function fillCanvasWithWhite() {
  const cols = canvas.width / pixelSize;
  const rows = canvas.height / pixelSize;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      drawPixel(x, y, '#FFFFFF'); // Закрашиваем пиксели в белый
    }
  }
}

// Функция для получения пикселей
async function fetchPixels() {
  try {
    fillCanvasWithWhite(); // Закрашиваем белым

    const response = await axios.get('http://localhost:8080/getPixels', {
      headers: {
        "Authorization": `Bearer ${window.localStorage.getItem("jwtToken")}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    });

    response.data.forEach(pixel => {
      drawPixel(pixel.x, pixel.y, pixel.color);
    });
  } catch (error) {
    console.error('Error fetching pixels:', error);
    throw error;
  }
}

// Функция отправки данных пикселя
// Функция отправки данных пикселя
async function sendPixelData(x, y, color) {
  // Проверяем, был ли инициализирован WebSocket
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("WebSocket не инициализирован или не подключен.");
    return false; // Прекращаем выполнение, если WebSocket недоступен
  }

  lastSendTime = await getLastClickFromServer(); // Получаем последний клик
  const currentTime = Date.now();

  // Проверка кулдауна
  if (currentTime - lastSendTime < cooldownTime) {
    console.log("Пиксель не отправлен, кулдаун ещё активен");
    return false;
  }

  // Данные пикселя
  const pixelData = {
    x,
    y,
    color,
    lastclick: currentTime,
    owner: parseInt(window.localStorage.getItem("id")),
  };

  console.log("Отправка данных пикселя:", pixelData);

  // Отправляем данные через WebSocket
  socket.send(JSON.stringify(pixelData));
  return true;
}
// Функция для затемнения цвета
function getSlightlyDarkerColor(hexColor) {
  let r = parseInt(hexColor.slice(1, 3), 16);
  let g = parseInt(hexColor.slice(3, 5), 16);
  let b = parseInt(hexColor.slice(5, 7), 16);

  const offset = 50; // На сколько затемнить
  r = Math.max(0, r - offset);
  g = Math.max(0, g - offset);
  b = Math.max(0, b - offset);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Функция рисования пикселя
function drawPixel(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize); // Рисуем пиксель
  ctx.lineWidth = 1; // Границы
  ctx.strokeStyle = getSlightlyDarkerColor(color); // Темная граница
  ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize); // Рисуем границу
}

// Инициализация WebSocket
function initWebSocket() {
  socket = new WebSocket(`ws://localhost:8080/webhook/ws?token=${window.localStorage.getItem("jwtToken")}`);

  socket.onopen = () => {
    console.log("Connected to WebSocket server");
    fetchPixels(); // Получаем пиксели после подключения
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received pixel data from WebSocket:", data);
    drawPixel(data.x, data.y, data.color);
  };

  socket.onclose = (event) => {
    console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
    if (event.code === 1001) {
      console.error("WebSocket closed with code 1001 (going away)");
    }
    // Переподключение
    setTimeout(initWebSocket, 2000);
  };
}

// Получение координат пикселя
function getPixelCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / pixelSize);
  const y = Math.floor((event.clientY - rect.top) / pixelSize);
  return { x, y };
}

// Обработка событий мыши
canvas.addEventListener('mousedown', async (event) => {
  if (!isAuthenticated()) {
    alert("Вы должны быть авторизованы, чтобы рисовать пиксели.");
    return; // Прекращаем выполнение функции, если не авторизован
  }

  isDrawing = true;
  const { x, y } = getPixelCoordinates(event);
  console.log(x, y);

  const color = document.querySelector('input[name="color"]:checked').value; // Получаем выбранный цвет

  if (await sendPixelData(x, y, color)) {
    drawPixel(x, y, color); // Рисуем пиксель на клиенте
  }
});
canvas.addEventListener('mouseup', () => {
  isDrawing = false;
});

// Функция отправки пикселей
async function sendPixels(pixels) {
  try {
    const response = await axios.post('http://localhost:8080/print', pixels, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.localStorage.getItem('jwtToken')}`,
      },
    });
    console.log('Response from server:', response.data);
  } catch (error) {
    console.error('Error sending pixels:', error);
  }
}

// Функция для рисования квадрата
async function printSquare(x1, y1, x2, y2, color) {
  const pixels = [];

  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x < x2; x++) {
      console.log(x, y);
      pixels.push({
        x,
        y,
        color,
      });
    }
  }
  const pixelsData = {
    id: 1,
    data: pixels,
  };
  await sendPixels(pixelsData);
}
const formOpenBtn = document.querySelector("#form-open"),
    home = document.querySelector(".home"),
    formContainer = document.querySelector(".form_container"),
    formCloseBtn = document.querySelector(".form_close"),
    signupBtn = document.querySelector("#signupBtn"),
    loginBtn = document.querySelector("#loginBtn"),
    pwShowHide = document.querySelectorAll(".pw_hide");
formOpenBtn.addEventListener("click", () => home.classList.add("show"));
formCloseBtn.addEventListener("click", () => home.classList.remove("show"));
pwShowHide.forEach((icon) => {
  icon.addEventListener("click", () => {
    let getPwInput = icon.parentElement.querySelector("input");
    if (getPwInput.type === "password") {
      getPwInput.type = "text";
      icon.classList.replace("uil-eye-slash", "uil-eye");
    } else {
      getPwInput.type = "password";
      icon.classList.replace("uil-eye", "uil-eye-slash");
    }
  });
});
signupBtn.addEventListener("click", (e) => {
  e.preventDefault();
  formContainer.classList.add("active");
});
loginBtn.addEventListener("click", (e) => {
  e.preventDefault();
  formContainer.classList.remove("active");
});
document.getElementById('loginBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const loginInput = document.querySelector('input[placeholder="Имя пользователя"]');
  const passwordInput = document.querySelector('input[placeholder="Введите пароль"]');

  const login = loginInput.value;
  const password = passwordInput.value;

  try {
    await signIn(login, password);
    initAfterLogin(); // Инициализация WebSocket после успешного входа
  } catch (error) {
    alert('Ошибка при входе: ' + error.message); // Вывод ошибки
  }
});

document.getElementById('registerButton').addEventListener('click', async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById('email').value;
  const loginInput = document.getElementById('signupLogin').value;
  const passwordInput = document.getElementById('signupPassword').value;
  const confirmPasswordInput = document.getElementById('confirmPassword').value;

  if (passwordInput !== confirmPasswordInput) {
    alert('Пароли не совпадают!');
    return;
  }

  try {
    const result = await signUp(loginInput, emailInput, passwordInput, confirmPasswordInput);
    if (result.status === "success") {
      alert('Регистрация успешна.');
      initAfterLogin();
    } else {
      alert('Ошибка регистрации.');
    }
  } catch (error) {
    alert('Ошибка при регистрации: ' + error.message);
  }
});
async function isAuthenticated() {
  const token = window.localStorage.getItem("jwtToken");

  if (!token) {
    return false; // Токен не существует
  }

  try {
    const response = await axios.get("http://localhost:8080/validateToken", {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    return response.data.isValid; // Предполагается, что сервер возвращает { isValid: true/false }
  } catch (error) {
    return false; // В случае ошибки также считаем, что пользователь не авторизован
  }
}
// Инициализация WebSocket после успешного входа
async function initAfterLogin() {
  initWebSocket(); // Подключаемся к WebSocket после авторизации
}

fetchPixels();
window.onload = async () => {
  const authenticated = await isAuthenticated();
  if (authenticated) {
    // Пользователь авторизован, выполните необходимые действия
    initAfterLogin(); // Например, инициализация WebSocket
  }
};
