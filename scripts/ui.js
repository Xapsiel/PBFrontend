// ui.js
import {auth, signIn, signUp, isAuthenticated, logout } from './auth.js';
import { showError as showErrorFunc } from './ui.js';
import {initWebSocket} from "./websocket.js";

const elements = {
    logoutButton: document.getElementById("exitBtn"),
    formOpenBtn: document.querySelector("#form-open"),
    home: document.querySelector(".home"),
    registerButton: document.querySelector("#registerButton"),
    loginBtn: document.querySelector("#loginBtn"),
    loginContainer: document.querySelector(".login_form"),
    signUpContainer: document.querySelector(".signup_form"),
    errorDisplay: document.getElementById('error-display'),
    errorText: document.getElementById('error-text'),
    signupBtn: document.querySelector("#signupBtn"),
    formContainer: document.querySelector(".form_container"),
    toLoginBtn: document.querySelector("#toLogin"),
};

// Ошибки
function showError(message) {
    elements.errorDisplay.style.display = 'block'; // Показываем сообщение
    elements.errorText.textContent = message;
    elements.errorDisplay.style.opacity = '1';
    setTimeout(() => {
        elements.errorDisplay.style.opacity = '0';
        setTimeout(() => elements.errorDisplay.style.display = 'none', 500); // Скрываем сообщение после исчезновения
    }, 5000);
}
async function initAfterLogin() {
    checkAuthentication();
    initWebSocket();
}
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

elements.registerButton.addEventListener("click", async (e) => {
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
        console.log(result);
        checkAuthentication();
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
        closeForm();
        checkAuthentication();
    } catch (error) {
        alert('Ошибка при входе: ' + error.message); // Вывод ошибки
    }
});

elements.logoutButton.addEventListener("click", (e) => {
    window.localStorage.removeItem("jwtToken");
    window.localStorage.removeItem("id");
    auth.token = null;
    auth.id = null;
    checkAuthentication();
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

// Проверка авторизации и отображение/скрытие кнопок
async function checkAuthentication() {
    const authenticated = await isAuthenticated();
    if (authenticated) {
        elements.logoutButton.style.display = "block";
        elements.formOpenBtn.style.display = "none";
    } else {
        elements.logoutButton.style.display = "none";
        elements.formOpenBtn.style.display = "block";
    }
}

export { elements, showError, openForm, closeForm, clearFormFields, checkAuthentication,initAfterLogin };