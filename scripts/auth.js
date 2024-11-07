// auth.js
import {showError} from "./ui.js"
import {elements} from "./ui.js";

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
        console.error("Error during SignUp",error);
        throw error;
    }
}

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
// Выход из системы
function logout() {
    window.localStorage.removeItem("jwtToken");
    window.localStorage.removeItem("id");
    auth.token = null;
    auth.id = null;
    checkAuthentication();
}

export { auth, signIn, signUp, isAuthenticated, logout,getLastClickFromServer };