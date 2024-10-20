const login = "ilya2s";
const email = "ilyas2@mail2";
const password = "2password";
const repeatPassword = "2password";
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const pixelSize = 10; // Размер каждого пикселя
let isDrawing = false;
let socket = null; // Глобальная переменная для WebSocket
let lastSendTime = 0; // Время последней отправки
const cooldownTime = 10000; // Кулдаун в миллисекундах (10 секунд)
var prevX = -1
var prevY = -1
var prevColor = "#0ff000"

// Функция для входа
async function signIn(login, password) {
  try {
    const response = await axios.post("http://localhost:8080/SignIn", {
      login: login,
      password: password
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
      login: login,
      email: email,
      password: password,
      repeatpassword: repeatPassword
    });
    console.log("Sign-up response:", response.data);
    if (response.data.status === "success") {
      await signIn(login, password); // Вход после успешной регистрации
    }
  } catch (error) {
    console.error("Error during SignUp:", error);
    throw error;
  }
}

// Функция для получения времени последнего клика с сервера
async function getLastClickFromServer() {
  try {
    const id = parseInt(window.localStorage.getItem("id"));
    console.log("Fetching last click for user ID:", id);
    const response = await axios.post('http://localhost:8080/getLastClick', {
      id: id
    }, {
      headers: {
        "Authorization": `Bearer ${window.localStorage.getItem("jwtToken")}`
      }
    });

    console.log("Last click received from server:", response.data.lastclick);
    return response.data.lastclick; // Убедитесь, что сервер возвращает корректные данные
  } catch (error) {
    console.error("Error fetching last click from server:", error);
    throw error;
  }
}

// Функция для закрашивания всех пикселей в белый цвет
function fillCanvasWithWhite() {
  for (let x = 0; x < canvas.width / pixelSize; x++) {
    for (let y = 0; y < canvas.height / pixelSize; y++) {
      drawPixel(x, y, '#FFFFFF'); // Закрашиваем пиксели в белый цвет
    }
  }
}

async function fetchPixels() {
  try {
    // Сначала закрашиваем все пиксели в белый цвет
    fillCanvasWithWhite();

    // Затем запрашиваем пиксели из базы данных и закрашиваем их
    const response = await axios.get('http://localhost:8080/getPixels', {
      headers: {
        "Authorization": `Bearer ${window.localStorage.getItem("jwtToken")}`,
        "Content-Type": "application/json; charset=UTF-8"
      }
    });

    // Закрашиваем пиксели из базы данных
    response.data.forEach(pixel => {
      console.log("Drawing pixel:", pixel);
      drawPixel(pixel.x, pixel.y, pixel.color);
    });
  } catch (error) {
    console.error('Error fetching pixels:', error);
    throw error;
  }
}

// Функция отправки данных пикселя
async function sendPixelData(x, y, color) {
  lastSendTime = await getLastClickFromServer() ; // Получаем последний клик с сервера
  const currentTime = Date.now() ;
  console.log(currentTime, lastSendTime, cooldownTime, parseInt(window.localStorage.getItem("id")));

  // Проверка кулдауна
  if (currentTime - lastSendTime < cooldownTime ) {
    console.log("Пиксель не отправлен, кулдаун ещё активен");
    return false;
  }

  // Данные пикселя, включая lastclick
  const pixelData = {
    x: x,
    y: y,
    color: color,
    lastclick: currentTime, // Время последнего клика
    owner: parseInt(window.localStorage.getItem("id"))
  };

  console.log("Отправка данных пикселя:", pixelData);

  // Отправляем данные через WebSocket
  socket.send(JSON.stringify(pixelData));
  return true;
}

function getSlightlyDarkerColor(hexColor) {
  // Преобразуем цвет из формата HEX (#ffffff) в RGB
  let r = parseInt(hexColor.slice(1, 3), 16);
  let g = parseInt(hexColor.slice(3, 5), 16);
  let b = parseInt(hexColor.slice(5, 7), 16);

  // Уменьшаем яркость каждого компонента на 10
  const offset = 50; // Насколько затемнить
  r = Math.max(0, r - offset);
  g = Math.max(0, g - offset);
  b = Math.max(0, b - offset);

  // Преобразуем обратно в HEX
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
// Функция рисования пикселя на холсте
function drawPixel(x, y, color) {
  console.log(color)

  ctx.fillStyle = color;

  // Рисуем сам пиксель
  ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
  // Настраиваем обводку
  ctx.lineWidth = 1; // Тонкая граница
  ctx.strokeStyle = getSlightlyDarkerColor(color); // Черная граница
  // Рисуем границу вокруг пикселя
  ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
}


// Инициализация WebSocket
function initWebSocket() {
  socket = new WebSocket(`ws://localhost:8080/webhook/ws?token=${window.localStorage.getItem("jwtToken")}`);

  socket.onopen = () => {
    console.log("Connected to WebSocket server");
    fetchPixels(); // Получаем пиксели сразу после подключения
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received pixel data from WebSocket:", data);
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
  isDrawing = true;
  const { x, y } = getPixelCoordinates(event);
  console.log(x,y)
  // Получаем выбранный цвет из радиокнопок
  const color = document.querySelector('input[name="color"]:checked').value;

  if (await sendPixelData(x, y, color)) {
    drawPixel(x, y, color); // Отрисовываем пиксель на клиенте
  }
});

canvas.addEventListener('mouseup', () => {
  isDrawing = false;
});

async function sendPixels(pixels) {

  try {
    const response = await axios.post('http://localhost:8080/print', pixels, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.localStorage.getItem('jwtToken')}`
      }
    });
    console.log('Response from server:', response.data);
  } catch (error) {
      console.error('Error sending pixels:', error);
  }
}

async function printSquare(x1,y1,x2,y2,color){
  pixels = []

  for (let y = y1; y <=y2 ; y++) {
    for (let x = x1; x < x2; x++) {
      console.log(x,y)
      pixels.push({
        x :x,
        y : y,
        color:  color
      })
    }
  }
  pixelsData = {
    id: 1,
    data: pixels
  };
  await  sendPixels(pixelsData)
}

// Вызов функции отправки пикселей

// Основная функция для регистрации и инициализации WebSocket
async function signUpAndInit() {
  // Пример использования функции sendPixels
  const pixelsData = {
    id: 1,
    data: [
      { x: 5, y: 7, color: '#FF0000' },
      { x: 6, y: 7, color: '#00FF00' },
      { x: 7, y: 7, color: '#ab28c9' },
      { x: 6, y: 6, color: '#444470' }
    ]
  };
  try {
    try {
      console.log(2);
      await signUp(login, email, password, repeatPassword);
    } catch (error) {
      console.log("User already exists or sign-up failed, proceeding to sign-in.");
    }

    await signIn(login, password);
    await sendPixels(pixelsData)
    await  printSquare(5,10,10,20,"#ea9d9d")
    await fetchPixels(); // Ждем получения пикселей
    initWebSocket(); // Инициализируем WebSocket после успешного входа






  } catch (error) {
    console.error("Error during sign-in or fetching pixels:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  signUpAndInit(); // Запуск процесса регистрации, получения пикселей и подключения WebSocket
});
