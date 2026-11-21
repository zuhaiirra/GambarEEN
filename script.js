
// =====================================
// GAMBARIN! - AUTHENTICATION SYSTEM
// =====================================

const modal = document.createElement("div");
modal.classList.add("modal");
document.body.appendChild(modal);

// =====================================
// 1. CEK ROLE & REDIRECT
// =====================================

async function redirectByRole(user) {
    if (!user) return;

    const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

    if (error || !profile) {
        console.error(
            "Gagal mengambil profil:",
            error?.message || "Profil tidak ditemukan."
        );
        return;
    }

    console.log("Role pengguna:", profile.role);

    if (profile.role === "seller") {
        window.location.replace("seller.html");

    } else if (profile.role === "buyer") {
        window.location.replace("buyer.html");

    } else if (profile.role === "admin") {
        window.location.replace("admin.html");

    } else {
        console.error("Role tidak dikenali:", profile.role);
    }
}

// =====================================
// 2. TAMPILKAN FORM LOGIN / REGISTER
// =====================================

function showForm(type) {
    let formContent = "";

    if (type === "login") {
        formContent = `
            <h2>Welcome Back!</h2>
            <p>Login untuk melanjutkan ke GambarIn!</p>

            <form id="userForm">
                <label>Email</label>
                <input
                    type="email"
                    id="email"
                    placeholder="Masukkan email"
                    required
                >

                <label>Password</label>
                <input
                    type="password"
                    id="password"
                    placeholder="Masukkan password"
                    required
                >

                <button type="submit" class="modal-submit">
                    Login
                </button>
            </form>

            <p id="formMessage"></p>

            <p class="switch-form">
                Belum punya akun?
                <a href="#" id="switchToRegister">Register</a>
            </p>
        `;

    } else {
        formContent = `
            <h2>Create Account</h2>
            <p>Bergabung dan mulai berkarya bersama GambarIn!</p>

            <form id="userForm">
                <label>Nama Lengkap</label>
                <input
                    type="text"
                    id="fullName"
                    placeholder="Masukkan nama"
                    required
                >

                <label>Email</label>
                <input
                    type="email"
                    id="email"
                    placeholder="Masukkan email"
                    required
                >

                <label>Password</label>
                <input
                    type="password"
                    id="password"
                    placeholder="Buat password (minimal 6 karakter)"
                    minlength="6"
                    required
                >

                <label>Daftar sebagai</label>
                <select id="role" required>
                    <option value="">Pilih peran</option>
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                </select>

                <button type="submit" class="modal-submit">
                    Register
                </button>
            </form>

            <p id="formMessage"></p>

            <p class="switch-form">
                Sudah punya akun?
                <a href="#" id="switchToLogin">Login</a>
            </p>
        `;
    }

    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-modal" id="closeModal">&times;</button>
            ${formContent}
        </div>
    `;

    modal.classList.add("active");

    document.getElementById("closeModal")
        .addEventListener("click", closeForm);

    const switchToRegister =
        document.getElementById("switchToRegister");

    const switchToLogin =
        document.getElementById("switchToLogin");

    if (switchToRegister) {
        switchToRegister.addEventListener("click", event => {
            event.preventDefault();
            showForm("register");
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener("click", event => {
            event.preventDefault();
            showForm("login");
        });
    }

    document.getElementById("userForm")
        .addEventListener("submit", handleAuth);
}

// =====================================
// 3. LOGIN & REGISTER
// =====================================

async function handleAuth(event) {
    event.preventDefault();

    const form = event.target;
    const message = document.getElementById("formMessage");
    const submitButton = form.querySelector('button[type="submit"]');

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "Memproses...";
    submitButton.disabled = true;

    try {
        // REGISTER
        const fullNameInput = document.getElementById("fullName");

        if (fullNameInput) {
            const fullName = fullNameInput.value.trim();
            const role = document.getElementById("role").value;

            if (!["buyer", "seller"].includes(role)) {
                throw new Error("Silakan pilih Buyer atau Seller.");
            }

            const { data, error } =
                await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role: role
                        }
                    }
                });

            if (error) throw error;

            if (data.session && data.user) {
                message.textContent = "Registrasi berhasil! Mengarahkan...";

                await redirectByRole(data.user);

            } else {
                message.textContent =
                    "Registrasi berhasil! Silakan cek email untuk verifikasi akun.";
            }

        } else {
            // LOGIN
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) throw error;

            if (!data.user) {
                throw new Error("Data akun tidak ditemukan.");
            }

            message.textContent = "Login berhasil! Mengarahkan...";

            await redirectByRole(data.user);
        }

    } catch (error) {
        console.error("Authentication error:", error);
        message.textContent = "Gagal: " + error.message;

    } finally {
        submitButton.disabled = false;
    }
}

// =====================================
// 4. LOGOUT
// =====================================

async function logoutGambarIn() {
    const confirmed = confirm("Yakin ingin logout?");

    if (!confirmed) return;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Gagal logout: " + error.message);
        return;
    }

    window.location.replace("index.html");
}

// =====================================
// 5. TUTUP MODAL
// =====================================

function closeForm() {
    modal.classList.remove("active");
}

// =====================================
// 6. BIND LOGIN & REGISTER BUTTON
// =====================================

function bindAuthButtons() {
    const loginBtn = document.querySelector(".btn-login");
    const registerBtn = document.querySelector(".btn-register");

    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            showForm("login");
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener("click", () => {
            showForm("register");
        });
    }
}

// =====================================
// 7. UPDATE NAVBAR
// =====================================

async function updateNavbar() {
    const navButtons = document.getElementById("navButtons");

    if (!navButtons) return;

    const { data: { user }, error: authError } =
        await supabaseClient.auth.getUser();

    if (authError) {
        console.error(authError);
        return;
    }

    if (!user) {
        navButtons.innerHTML = `
            <button class="btn-login">Login</button>
            <button class="btn-register">Register</button>
        `;

        bindAuthButtons();
        return;
    }

    const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

    if (error || !profile) {
        console.error("Gagal mengambil profil:", error?.message);
        return;
    }

    navButtons.innerHTML = "";

    const greeting = document.createElement("span");
    greeting.textContent =
        `Halo, ${profile.full_name || user.email}!`;

    const roleLabel = document.createElement("span");
    roleLabel.textContent = profile.role.toUpperCase();
    roleLabel.classList.add("user-role");

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Logout";
    logoutBtn.classList.add("btn-register");
    logoutBtn.addEventListener("click", logoutGambarIn);

    navButtons.append(greeting, roleLabel, logoutBtn);
}

// =====================================
// 8. INITIALIZATION
// =====================================

document.addEventListener("DOMContentLoaded", async () => {
    bindAuthButtons();

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeForm();
        }
    });

    // Cek sesi ketika halaman Home dibuka
    const { data: { user }, error } =
        await supabaseClient.auth.getUser();

    if (error) {
        console.error("Gagal mengecek sesi:", error);
        return;
    }

    if (user) {
        await redirectByRole(user);
    } else {
        await updateNavbar();
    }
});
