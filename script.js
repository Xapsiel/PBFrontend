const pixelSize = 10;
const cooldownTime = 10000;
let socket = null;

const state = {
  isDrawing: false,
  lastSendTime: 0,
  prevCoords: { x: 0, y: 0 },
};

const elements = {
  canvas: document.getElementById('pixelCanvas'),
  ctx: document.getElementById('pixelCanvas').getContext('2d'),
  coordinates: document.getElementById("coordinateDisplay"),
  logoutButton: document.getElementById("exitBtn"),
  formOpenBtn: document.querySelector("#form-open"),
  home: document.querySelector(".home"),
  registerButton: document.querySelector("#registerButton"),
  loginBtn :document.querySelector("#loginBtn"),
  loginContainer: document.querySelector(".login_form"),
  signUpContainer: document.querySelector(".signup_form"),
  errorDisplay: document.getElementById('error-display'),
  errorText: document.getElementById('error-text'),
  signupBtn:document.querySelector("#signupBtn"),
  formContainer : document.querySelector(".form_container"),
  toLoginBtn: document.querySelector("#toLogin"),

};

const auth = {
  token: window.localStorage.getItem("jwtToken"),
  id: window.localStorage.getItem("id"),
};

// Вход в систему
async function signIn(login, password) {
  try {
    const response = await axios.post("http://localhost:8080/auth/sign-in", { login, password });
    const { token, id } = response.data;
    if (token) {
      auth.token = token;
      auth.id = id;
      window.localStorage.setItem("jwtToken", token);
      window.localStorage.setItem("id", id);
      return token;
    } else {
      throw new Error("No token received during sign-in.");
    }
  } catch (error) {
    console.error("Error during SignIn:", error);
    throw error;
  }
}

// Регистрация
async function signUp(login, email, password, repeatPassword) {
  try {
    const response = await axios.post("http://localhost:8080/auth/sign-up", {
      login, email, password, repeatpassword: repeatPassword,
    });
    if (response.data.status === "success") {
      await signIn(login, password);
      elements.home.classList.remove("show");
      elements.formOpenBtn.style.display = "none";
    }
    return response.data;

  } catch (error) {
    console.error("Error during SignUp:", error);
    throw error;
  }
}

// Получение последнего времени клика
async function getLastClickFromServer() {
  try {
    const response = await axios.post('http://localhost:8080/api/getLastClick', {
      id: parseInt(auth.id),
    }, { headers: { "Authorization": `Bearer ${auth.token}` } });
    return response.data.lastclick;
  } catch (error) {
    console.error("Error fetching last click from server:", error);
    throw error;
  }
}

// Заполнение белым цветом
function fillCanvasWithWhite() {
  const cols = elements.canvas.width / pixelSize;
  const rows = elements.canvas.height / pixelSize;
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
  elements.ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
}

// Инициализация WebSocket
function initWebSocket() {
  socket = new WebSocket(`ws://localhost:8080/webhook/ws?token=${auth.token}`);
  socket.onopen = fetchPixels;
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    drawPixel(data.x, data.y, data.color);
  };
  socket.onclose = () => setTimeout(initWebSocket, 2000);
}

// Получение координат пикселя
function getPixelCoordinates(event) {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - rect.left) / pixelSize),
    y: Math.floor((event.clientY - rect.top) / pixelSize),
  };
}

// Ошибки
function showError(message) {
  elements.errorText.textContent = message;
  elements.errorDisplay.style.opacity = '1';
  setTimeout(() => elements.errorDisplay.style.opacity = '0', 5000);
}

// Обработка событий
elements.canvas.addEventListener('mousedown', async (event) => {
  if (!await isAuthenticated()) {
    showError("Вы должны быть авторизованы, чтобы рисовать пиксели.");
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

// Функция для открытия модального окна
function openForm() {
  elements.home.classList.add("show");
  elements.loginContainer.classList.remove("active");
}

// Функция для закрытия модального окна
function closeForm() {
  elements.home.classList.remove("show");
  clearFormFields(); // Очищаем поля ввода
}

function clearFormFields() {
  const inputs = document.querySelectorAll('.form_container input');
  inputs.forEach(input => input.value = '');
}

elements.registerButton.addEventListener("click", async  (e) => {
  e.preventDefault();

  const emailInput = document.getElementById('email').value;
  const loginInput = document.getElementById('signupLogin').value;
  const passwordInput = document.getElementById('signupPassword').value;
  const confirmPasswordInput = document.getElementById('confirmPassword').value;

  if (passwordInput !== confirmPasswordInput) {
    showError('Пароли не совпадают!');
    return;
  }

  try {
    const result = await signUp(loginInput, emailInput, passwordInput, confirmPasswordInput);
    console.log(result)
    if (result.status === "success") {
      await  signIn(loginInput,passwordInput)
    } else {
      showError('Ошибка регистрации.');
    }

  } catch (error) {
    showError('Ошибка при регистрации');
  } // Переключаем форму на регистрацию
});
elements.loginBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const loginInput = document.querySelector('input[placeholder="Имя пользователя"]');
  const passwordInput = document.querySelector('input[placeholder="Введите пароль"]');

  const login = loginInput.value;
  const password = passwordInput.value;

  try {
    await signIn(login, password);
    initAfterLogin(); // Инициализация WebSocket после успешного входа
    closeForm()
  } catch (error) {
    alert('Ошибка при входе: ' + error.message); // Вывод ошибки
  }
});
document.addEventListener("click", (event) => {
  if (!elements.formContainer.contains(event.target) && !elements.formOpenBtn.contains(event.target)) {
    closeForm();
  }
});
elements.toLoginBtn.addEventListener("click", (e) => {
  e.preventDefault();
  elements.formContainer.classList.remove("active");
});
// Обработчик для открытия модального окна при нажатии на кнопку
elements.formOpenBtn.addEventListener("click", openForm);

// Обработчик для закрытия модального окна при клике вне окна или на кнопку закрытия
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("form_container")) {
    closeForm();
  }
});
elements.signupBtn.addEventListener("click", (e) => {
  e.preventDefault();
  elements.formContainer.classList.add("active");
});

// Добавляем также обработчик для кнопки закрытия внутри модального окна, если она есть
document.querySelector(".form-close-btn")?.addEventListener("click", closeForm);

// Проверка авторизации
async function isAuthenticated() {
  try {
    const response = await axios.get("http://localhost:8080/auth/validateToken", {
      headers: { "Authorization": `Bearer ${auth.token}` },
    });
    return response.data.isValid;
  } catch (error) {
    showError("Вы не авторизованы");
    return false;
  }
}

// Инициализация
function initializeApp() {
  fetchPixels();
  if (auth.token) initAfterLogin();
}

// Запуск приложения
window.addEventListener("load", initializeApp);

async function initAfterLogin() {
  initWebSocket();
}