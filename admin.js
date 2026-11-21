
/* =========================================================
   GAMBARIN! - ADMIN DASHBOARD
   Sistem harga:
   - Seller menentukan biaya tambahan.
   - Buyer membayar subtotal yang disepakati.
   - Komisi platform 10% dipotong dari pendapatan Seller.
   - Admin hanya memverifikasi pembayaran, bukan menentukan harga.
========================================================= */

const ADMIN_STATUSES = {
    waiting_seller_quote: "Menunggu Penawaran Seller",
    waiting_buyer_approval: "Menunggu Persetujuan Buyer",
    waiting_payment: "Menunggu Pembayaran",
    waiting_verification: "Menunggu Verifikasi Pembayaran",
    confirmed: "Pembayaran Terverifikasi",
    in_progress: "Sedang Dikerjakan",
    revision: "Revisi",
    completed: "Selesai",
    cancelled: "Dibatalkan",
    pending: "Menunggu"
};

let adminUser = null;
let adminProfile = null;

let adminArtworks = [];
let adminUsers = [];
let adminOrders = [];

let selectedArtworkId = null;
let selectedOrderId = null;

/* =========================================================
   HELPER
========================================================= */

const $ = (id) => document.getElementById(id);

function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getInitial(name = "A") {
    return String(name).trim().charAt(0).toUpperCase() || "A";
}

function showMessage(message, isError = false) {
    const element = $("globalMessage");
    if (!element) return;

    element.textContent = message;
    element.classList.remove("hidden", "error");

    if (isError) element.classList.add("error");

    window.scrollTo({ top: 0, behavior: "smooth" });

    setTimeout(() => {
        element.classList.add("hidden");
    }, 4500);
}

function setButtonLoading(button, loading, originalText = "Simpan") {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Memproses..." : originalText;
}

function statusBadge(status) {
    const label = ADMIN_STATUSES[status] || status || "Tidak diketahui";

    let className = "status-pending";

    if (["approved", "completed", "confirmed"].includes(status)) {
        className = "status-approved";
    } else if (["rejected", "cancelled"].includes(status)) {
        className = "status-rejected";
    } else if (["in_progress", "revision", "waiting_payment"].includes(status)) {
        className = "status-confirmed";
    }

    return `
        <span class="status-badge ${className}">
            ${escapeHTML(label)}
        </span>
    `;
}

/* =========================================================
   AUTHENTICATION
========================================================= */

async function checkAdminAccess() {
    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = "login.html";
        return false;
    }

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

    if (profileError || !profile || profile.role !== "admin") {
        alert("Akses hanya untuk Admin.");
        window.location.href = "login.html";
        return false;
    }

    adminUser = user;
    adminProfile = profile;

    return true;
}

/* =========================================================
   PROFILE ADMIN
========================================================= */

function renderAdminProfile() {
    if (!adminProfile) return;

    const name = adminProfile.full_name || "Administrator";
    const avatar = adminProfile.avatar_url;

    if ($("sidebarName")) {
        $("sidebarName").textContent = name;
    }

    if ($("topbarName")) {
        $("topbarName").textContent = name;
    }

    if ($("welcomeAdmin")) {
        $("welcomeAdmin").textContent = name;
    }

    ["sidebarAvatar", "topbarAvatar"].forEach((id) => {
        const element = $(id);
        if (!element) return;

        if (avatar) {
            element.style.backgroundImage = `url("${avatar}")`;
            element.textContent = "";
        } else {
            element.style.backgroundImage = "";
            element.textContent = getInitial(name);
        }
    });

    if ($("adminFullName")) {
        $("adminFullName").value = adminProfile.full_name || "";
    }

    if ($("adminUsername")) {
        $("adminUsername").value = adminProfile.username || "";
    }

    if ($("adminEmail")) {
        $("adminEmail").value = adminUser.email || "";
    }

    if ($("adminBio")) {
        $("adminBio").value = adminProfile.bio || "";
    }

    if ($("profileAvatar")) {
        $("profileAvatar").style.backgroundImage = avatar
            ? `url("${avatar}")`
            : "";

        $("profileAvatar").textContent = avatar
            ? ""
            : getInitial(name);
    }
}

async function saveAdminProfile(event) {
    event.preventDefault();

    const button = $("adminProfileForm")?.querySelector(
        'button[type="submit"]'
    );

    setButtonLoading(button, true, "Simpan Profil");

    try {
        const updates = {
            full_name: $("adminFullName")?.value.trim(),
            username: $("adminUsername")?.value.trim(),
            bio: $("adminBio")?.value.trim()
        };

        const { error } = await supabaseClient
            .from("profiles")
            .update(updates)
            .eq("id", adminUser.id);

        if (error) throw error;

        adminProfile = {
            ...adminProfile,
            ...updates
        };

        renderAdminProfile();
        showMessage("Profil Admin berhasil diperbarui.");
    } catch (error) {
        console.error(error);
        showMessage(error.message || "Gagal memperbarui profil.", true);
    } finally {
        setButtonLoading(button, false, "Simpan Profil");
    }
}

async function uploadAdminAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showMessage("File harus berupa gambar.", true);
        return;
    }

    try {
        const extension = file.name.split(".").pop();
        const filePath = `${adminUser.id}/admin-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabaseClient.storage
            .from("avatars")
            .upload(filePath, file, {
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data } = supabaseClient.storage
            .from("avatars")
            .getPublicUrl(filePath);

        const avatarUrl = data.publicUrl;

        const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({ avatar_url: avatarUrl })
            .eq("id", adminUser.id);

        if (updateError) throw updateError;

        adminProfile.avatar_url = avatarUrl;
        renderAdminProfile();

        showMessage("Foto profil berhasil diperbarui.");
    } catch (error) {
        console.error(error);
        showMessage(error.message || "Gagal mengunggah foto.", true);
    }
}

/* =========================================================
   NAVIGATION
========================================================= */

function initAdminNavigation() {
    document.querySelectorAll(".menu-item[data-page]").forEach((button) => {
        button.addEventListener("click", () => {
            const page = button.dataset.page;

            document.querySelectorAll(".menu-item").forEach((item) => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            document.querySelectorAll(".page-section").forEach((section) => {
                section.classList.add("hidden");
            });

            const target = $(`page-${page}`);
            if (target) target.classList.remove("hidden");

            const heading = {
                dashboard: "Dashboard",
                artworks: "Moderasi Artwork",
                users: "Kelola Pengguna",
                orders: "Kelola Pesanan",
                profile: "Profil Admin"
            };

            if ($("pageHeading")) {
                $("pageHeading").textContent = heading[page] || "Dashboard";
            }
        });
    });
}

/* =========================================================
   LOAD DATA
========================================================= */

async function loadAdminData() {
    await Promise.all([
        loadAdminArtworks(),
        loadAdminUsers(),
        loadAdminOrders()
    ]);

    renderAdminDashboard();
}

/* =========================================================
   ARTWORK MANAGEMENT
========================================================= */

async function loadAdminArtworks() {
    const { data, error } = await supabaseClient
        .from("artworks")
        .select(`
            *,
            seller:profiles!artworks_seller_id_fkey (
                id,
                full_name,
                username,
                store_name
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Load artworks:", error);
        throw error;
    }

    adminArtworks = data || [];

    renderAdminArtworks();
    renderDashboardPending();
}

function renderAdminArtworks() {
    const container = $("adminArtworkList");
    if (!container) return;

    const keyword = $("searchArtwork")?.value.toLowerCase() || "";
    const filter = $("artworkStatusFilter")?.value || "all";

    const filtered = adminArtworks.filter((artwork) => {
        const matchesKeyword =
            artwork.title?.toLowerCase().includes(keyword) ||
            artwork.seller?.full_name?.toLowerCase().includes(keyword) ||
            artwork.seller?.username?.toLowerCase().includes(keyword);

        const matchesStatus =
            filter === "all" || artwork.status === filter;

        return matchesKeyword && matchesStatus;
    });

    if (!filtered.length) {
        container.innerHTML = `
            <div class="empty-state">
                Tidak ada artwork yang ditemukan.
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((artwork) => `
        <article class="artwork-card">
            <img
                class="artwork-image"
                src="${escapeHTML(artwork.image_url || "")}"
                alt="${escapeHTML(artwork.title)}"
                onerror="this.style.display='none'"
            >

            <div class="artwork-info">
                <h4>${escapeHTML(artwork.title)}</h4>

                <p>
                    Seller:
                    ${escapeHTML(
                        artwork.seller?.store_name ||
                        artwork.seller?.full_name ||
                        "-"
                    )}
                </p>

                <p>${escapeHTML(artwork.category || "-")}</p>

                <div class="artwork-meta">
                    <strong>${formatRupiah(artwork.price)}</strong>
                    ${statusBadge(artwork.status)}
                </div>

                <div class="artwork-actions">
                    <button
                        class="primary-button"
                        onclick="openArtworkDetail('${artwork.id}')"
                    >
                        Detail
                    </button>

                    ${
                        artwork.status === "pending"
                            ? `
                                <button
                                    class="approve-button"
                                    onclick="approveArtwork('${artwork.id}')"
                                >
                                    Setujui
                                </button>
                            `
                            : ""
                    }

                    ${
                        artwork.status === "pending"
                            ? `
                                <button
                                    class="reject-button"
                                    onclick="openRejectModal('${artwork.id}')"
                                >
                                    Tolak
                                </button>
                            `
                            : ""
                    }
                </div>
            </div>
        </article>
    `).join("");
}

function openArtworkDetail(id) {
    const artwork = adminArtworks.find((item) => item.id === id);
    if (!artwork) return;

    selectedArtworkId = id;

    const container = $("artworkModalContent");
    if (!container) return;

    container.innerHTML = `
        <h3>${escapeHTML(artwork.title)}</h3>

        <img
            src="${escapeHTML(artwork.image_url || "")}"
            alt="${escapeHTML(artwork.title)}"
        >

        <p><strong>Deskripsi:</strong><br>
            ${escapeHTML(artwork.description || "-")}
        </p>

        <p><strong>Kategori:</strong>
            ${escapeHTML(artwork.category || "-")}
        </p>

        <p><strong>Harga dasar:</strong>
            ${formatRupiah(artwork.price)}
        </p>

        <p><strong>Seller:</strong>
            ${escapeHTML(
                artwork.seller?.store_name ||
                artwork.seller?.full_name ||
                "-"
            )}
        </p>

        <p><strong>Status:</strong>
            ${statusBadge(artwork.status)}
        </p>
    `;

    $("artworkModal")?.classList.remove("hidden");
}

async function approveArtwork(id) {
    if (!confirm("Setujui artwork ini agar dapat dilihat Buyer?")) return;

    try {
        const { error } = await supabaseClient
            .from("artworks")
            .update({
                status: "approved",
                rejection_reason: null
            })
            .eq("id", id);

        if (error) throw error;

        await loadAdminArtworks();
        renderAdminDashboard();

        showMessage("Artwork berhasil disetujui.");
    } catch (error) {
        console.error(error);
        showMessage(error.message || "Gagal menyetujui artwork.", true);
    }
}

function openRejectModal(id) {
    selectedArtworkId = id;

    if ($("rejectionReason")) {
        $("rejectionReason").value = "";
    }

    $("rejectMessage")?.classList.add("hidden");
    $("rejectModal")?.classList.remove("hidden");
}

async function rejectArtwork() {
    if (!selectedArtworkId) return;

    const reason = $("rejectionReason")?.value.trim();

    if (!reason) {
        if ($("rejectMessage")) {
            $("rejectMessage").textContent =
                "Alasan penolakan wajib diisi.";
            $("rejectMessage").classList.remove("hidden");
        }
        return;
    }

    const button = $("confirmRejectButton");
    setButtonLoading(button, true, "Tolak Artwork");

    try {
        const { error } = await supabaseClient
            .from("artworks")
            .update({
                status: "rejected",
                rejection_reason: reason
            })
            .eq("id", selectedArtworkId);

        if (error) throw error;

        $("rejectModal")?.classList.add("hidden");

        await loadAdminArtworks();
        renderAdminDashboard();

        showMessage("Artwork berhasil ditolak.");
    } catch (error) {
        console.error(error);

        if ($("rejectMessage")) {
            $("rejectMessage").textContent =
                error.message || "Gagal menolak artwork.";
            $("rejectMessage").classList.remove("hidden");
        }
    } finally {
        setButtonLoading(button, false, "Tolak Artwork");
    }
}

function renderDashboardPending() {
    const container = $("dashboardPending");
    if (!container) return;

    const pending = adminArtworks
        .filter((item) => item.status === "pending")
        .slice(0, 5);

    if ($("pendingBadge")) {
        $("pendingBadge").textContent = pending.length;
    }

    if (!pending.length) {
        container.innerHTML = `
            <div class="empty-state">
                Tidak ada artwork yang menunggu moderasi.
            </div>
        `;
        return;
    }

    container.innerHTML = pending.map((item) => `
        <div class="table-user">
            <div class="table-avatar">
                ${getInitial(item.title)}
            </div>

            <div>
                <strong>${escapeHTML(item.title)}</strong>
                <small>${formatRupiah(item.price)}</small>
            </div>

            <button
                class="text-button"
                onclick="openArtworkDetail('${item.id}')"
            >
                Lihat
            </button>
        </div>
    `).join("");
}

/* =========================================================
   USER MANAGEMENT
========================================================= */

async function loadAdminUsers() {
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Load users:", error);
        throw error;
    }

    adminUsers = data || [];
    renderAdminUsers();
}

function renderAdminUsers() {
    const container = $("adminUserList");
    if (!container) return;

    const keyword = $("searchUser")?.value.toLowerCase() || "";
    const role = $("userRoleFilter")?.value || "all";

    const filtered = adminUsers.filter((user) => {
        const matchesKeyword =
            user.full_name?.toLowerCase().includes(keyword) ||
            user.username?.toLowerCase().includes(keyword) ||
            user.store_name?.toLowerCase().includes(keyword);

        const matchesRole = role === "all" || user.role === role;

        return matchesKeyword && matchesRole;
    });

    if (!filtered.length) {
        container.innerHTML = `
            <div class="empty-state">
                Pengguna tidak ditemukan.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Pengguna</th>
                        <th>Username</th>
                        <th>Peran</th>
                        <th>Tanggal Bergabung</th>
                    </tr>
                </thead>

                <tbody>
                    ${filtered.map((user) => `
                        <tr>
                            <td>
                                <div class="table-user">
                                    <div class="table-avatar">
                                        ${getInitial(user.full_name)}
                                    </div>

                                    <strong>
                                        ${escapeHTML(user.full_name || "-")}
                                    </strong>
                                </div>
                            </td>

                            <td>${escapeHTML(user.username || "-")}</td>

                            <td>
                                <span class="role-badge">
                                    ${escapeHTML(user.role || "-")}
                                </span>
                            </td>

                            <td>${formatDate(user.created_at)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

/* =========================================================
   ORDER MANAGEMENT
========================================================= */

async function loadAdminOrders() {
    const { data, error } = await supabaseClient
        .from("orders")
        .select(`
            *,
            artwork:artworks (
                id,
                title,
                image_url
            ),
            buyer:profiles!orders_buyer_id_fkey (
                id,
                full_name,
                username
            ),
            seller:profiles!orders_seller_id_fkey (
                id,
                full_name,
                username,
                store_name
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Load orders:", error);
        throw error;
    }

    adminOrders = data || [];

    renderAdminOrders();
    renderDashboardOrders();
}

function renderAdminOrders() {
    const container = $("adminOrderList");
    if (!container) return;

    const keyword = $("searchOrder")?.value.toLowerCase() || "";
    const filter = $("orderStatusFilter")?.value || "all";

    const filtered = adminOrders.filter((order) => {
        const matchesKeyword =
            order.artwork?.title?.toLowerCase().includes(keyword) ||
            order.buyer?.full_name?.toLowerCase().includes(keyword) ||
            order.seller?.full_name?.toLowerCase().includes(keyword) ||
            order.id?.toLowerCase().includes(keyword);

        const matchesStatus =
            filter === "all" || order.status === filter;

        return matchesKeyword && matchesStatus;
    });

    if (!filtered.length) {
        container.innerHTML = `
            <div class="empty-state">
                Belum ada pesanan yang sesuai.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Pesanan</th>
                        <th>Buyer</th>
                        <th>Seller</th>
                        <th>Subtotal</th>
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>

                <tbody>
                    ${filtered.map((order) => `
                        <tr>
                            <td>
                                <strong>
                                    ${escapeHTML(order.artwork?.title || "-")}
                                </strong>
                                <br>
                                <small>${formatDate(order.created_at)}</small>
                            </td>

                            <td>
                                ${escapeHTML(order.buyer?.full_name || "-")}
                            </td>

                            <td>
                                ${escapeHTML(
                                    order.seller?.store_name ||
                                    order.seller?.full_name ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${formatRupiah(
                                    order.service_subtotal ??
                                    order.total_price
                                )}
                            </td>

                            <td>${statusBadge(order.status)}</td>

                            <td>
                                <button
                                    class="primary-button"
                                    onclick="openOrderDetail('${order.id}')"
                                >
                                    Detail
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderDashboardOrders() {
    const container = $("dashboardOrders");
    if (!container) return;

    const latest = adminOrders.slice(0, 5);

    if (!latest.length) {
        container.innerHTML = `
            <div class="empty-state">
                Belum ada pesanan.
            </div>
        `;
        return;
    }

    container.innerHTML = latest.map((order) => `
        <div class="table-user">
            <div class="table-avatar">
                ${getInitial(order.artwork?.title)}
            </div>

            <div>
                <strong>
                    ${escapeHTML(order.artwork?.title || "Pesanan")}
                </strong>
                <small>
                    ${escapeHTML(order.buyer?.full_name || "-")}
                    · ${formatRupiah(
                        order.service_subtotal ?? order.total_price
                    )}
                </small>
            </div>

            ${statusBadge(order.status)}

            <button
                class="text-button"
                onclick="openOrderDetail('${order.id}')"
            >
                Detail
            </button>
        </div>
    `).join("");
}

function openOrderDetail(id) {
    const order = adminOrders.find((item) => item.id === id);
    if (!order) return;

    selectedOrderId = id;

    const subtotal = Number(
        order.service_subtotal ?? order.total_price ?? 0
    );

    const commissionRate = Number(order.platform_fee_rate ?? 10);
    const commission = Number(
        order.platform_fee_amount ??
        (subtotal * commissionRate / 100)
    );

    const sellerEarning = Number(
        order.seller_earning ?? (subtotal - commission)
    );

    const proofHTML = order.payment_proof
        ? `
            <p>
                <strong>Bukti pembayaran:</strong><br>
                <a href="${escapeHTML(order.payment_proof)}"
                   target="_blank" rel="noopener">
                    Lihat bukti pembayaran
                </a>
            </p>
        `
        : `<p><strong>Bukti pembayaran:</strong> Belum diunggah</p>`;

    const finalHTML = order.final_file_url
        ? `
            <p>
                <strong>File hasil akhir:</strong><br>
                <a href="${escapeHTML(order.final_file_url)}"
                   target="_blank" rel="noopener">
                    Lihat file hasil
                </a>
            </p>
        `
        : `<p><strong>File hasil akhir:</strong> Belum tersedia</p>`;

    const container = $("adminOrderList");

    const modal = document.createElement("div");
    modal.id = "adminOrderDetailModal";
    modal.className = "modal-overlay";

    modal.innerHTML = `
        <div class="modal-box">
            <button
                class="modal-close"
                type="button"
                onclick="closeOrderDetail()"
            >&times;</button>

            <h3>Detail Pesanan</h3>

            <p><strong>ID Pesanan:</strong><br>
                ${escapeHTML(order.id)}
            </p>

            <p><strong>Artwork:</strong><br>
                ${escapeHTML(order.artwork?.title || "-")}
            </p>

            <p><strong>Buyer:</strong><br>
                ${escapeHTML(order.buyer?.full_name || "-")}
            </p>

            <p><strong>Seller:</strong><br>
                ${escapeHTML(
                    order.seller?.store_name ||
                    order.seller?.full_name ||
                    "-"
                )}
            </p>

            <hr>

            <h4>Spesifikasi Pesanan</h4>

            <p><strong>Ukuran:</strong> ${escapeHTML(order.size || "-")}</p>
            <p><strong>Resolusi:</strong> ${escapeHTML(order.resolution || "-")}</p>
            <p><strong>Format:</strong> ${escapeHTML(order.file_format || "-")}</p>
            <p><strong>Jumlah:</strong> ${Number(order.quantity || 1)}</p>
            <p><strong>WhatsApp:</strong> ${escapeHTML(order.whatsapp || "-")}</p>
            <p><strong>Brief:</strong><br>
                ${escapeHTML(order.brief || order.note || "-")}
            </p>

            <hr>

            <h4>Rincian Harga</h4>

            <p>Harga dasar:
                <strong>${formatRupiah(order.base_price)}</strong>
            </p>

            <p>Biaya tambahan:
                <strong>${formatRupiah(order.additional_fee)}</strong>
            </p>

            <p>Catatan biaya tambahan:<br>
                ${escapeHTML(order.additional_fee_note || "-")}
            </p>

            <p>Catatan penawaran Seller:<br>
                ${escapeHTML(order.seller_quote_note || "-")}
            </p>

            <p>Subtotal yang dibayar Buyer:
                <strong>${formatRupiah(subtotal)}</strong>
            </p>

            <p>Komisi platform (${commissionRate}%):
                <strong>${formatRupiah(commission)}</strong>
            </p>

            <p>Pendapatan Seller:
                <strong>${formatRupiah(sellerEarning)}</strong>
            </p>

            <hr>

            <h4>Pembayaran</h4>

            <p>Status pembayaran:
                ${statusBadge(order.payment_status)}
            </p>

            <p>Metode pembayaran:
                ${escapeHTML(order.payment_method || "-")}
            </p>

            ${proofHTML}

            <p>Status pesanan:
                ${statusBadge(order.status)}
            </p>

            <p>Progress:
                ${Number(order.progress || 0)}%
            </p>

            <p>Catatan progress:
                ${escapeHTML(order.progress_note || "-")}
            </p>

            ${finalHTML}

            ${
                order.status === "waiting_verification" &&
                order.payment_status === "awaiting_verification"
                    ? `
                        <div class="artwork-actions">
                            <button
                                class="approve-button"
                                onclick="verifyPayment('${order.id}')"
                            >
                                Verifikasi Pembayaran
                            </button>

                            <button
                                class="reject-button"
                                onclick="rejectPayment('${order.id}')"
                            >
                                Tolak Pembayaran
                            </button>
                        </div>
                    `
                    : ""
            }

            <p class="form-message" id="orderAdminMessage"></p>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeOrderDetail() {
    $("adminOrderDetailModal")?.remove();
}

/* =========================================================
   PAYMENT VERIFICATION
========================================================= */

async function verifyPayment(id) {
    if (!confirm("Verifikasi pembayaran pesanan ini?")) return;

    try {
        const { error } = await supabaseClient
            .from("orders")
            .update({
                payment_status: "paid"
            })
            .eq("id", id);

        if (error) throw error;

        closeOrderDetail();

        await loadAdminOrders();
        renderAdminDashboard();

        showMessage("Pembayaran berhasil diverifikasi.");
    } catch (error) {
        console.error(error);
        showMessage(
            error.message || "Gagal memverifikasi pembayaran.",
            true
        );
    }
}

async function rejectPayment(id) {
    const reason = prompt("Masukkan alasan penolakan pembayaran:");

    if (reason === null) return;

    try {
        const { error } = await supabaseClient
            .from("orders")
            .update({
                payment_status: "rejected"
            })
            .eq("id", id);

        if (error) throw error;

        closeOrderDetail();

        await loadAdminOrders();

        showMessage(
            reason.trim()
                ? `Pembayaran ditolak. Alasan: ${reason}`
                : "Pembayaran ditolak."
        );
    } catch (error) {
        console.error(error);
        showMessage(
            error.message || "Gagal menolak pembayaran.",
            true
        );
    }
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function renderAdminDashboard() {
    const totalUsers = adminUsers.length;
    const totalArtworks = adminArtworks.length;

    const pendingArtworks = adminArtworks.filter(
        (item) => item.status === "pending"
    ).length;

    const totalOrders = adminOrders.length;

    if ($("totalUsers")) {
        $("totalUsers").textContent = totalUsers;
    }

    if ($("totalArtworks")) {
        $("totalArtworks").textContent = totalArtworks;
    }

    if ($("pendingArtworks")) {
        $("pendingArtworks").textContent = pendingArtworks;
    }

    if ($("totalOrders")) {
        $("totalOrders").textContent = totalOrders;
    }

    renderDashboardPending();
    renderDashboardOrders();
}

/* =========================================================
   FILTER EVENTS
========================================================= */

function initAdminFilters() {
    $("searchArtwork")?.addEventListener("input", renderAdminArtworks);
    $("artworkStatusFilter")?.addEventListener("change", renderAdminArtworks);

    $("searchUser")?.addEventListener("input", renderAdminUsers);
    $("userRoleFilter")?.addEventListener("change", renderAdminUsers);

    $("searchOrder")?.addEventListener("input", renderAdminOrders);
    $("orderStatusFilter")?.addEventListener("change", renderAdminOrders);
}

/* =========================================================
   MODAL EVENTS
========================================================= */

function initAdminModals() {
    $("closeArtworkModal")?.addEventListener("click", () => {
        $("artworkModal")?.classList.add("hidden");
    });

    $("closeRejectModal")?.addEventListener("click", () => {
        $("rejectModal")?.classList.add("hidden");
    });

    $("confirmRejectButton")?.addEventListener(
        "click",
        rejectArtwork
    );

    $("artworkModal")?.addEventListener("click", (event) => {
        if (event.target === $("artworkModal")) {
            $("artworkModal").classList.add("hidden");
        }
    });

    $("rejectModal")?.addEventListener("click", (event) => {
        if (event.target === $("rejectModal")) {
            $("rejectModal").classList.add("hidden");
        }
    });
}

/* =========================================================
   LOGOUT
========================================================= */

async function logoutAdmin() {
    const confirmed = confirm("Yakin ingin keluar dari akun Admin?");
    if (!confirmed) return;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showMessage(error.message, true);
        return;
    }

    window.location.href = "login.html";
}

/* =========================================================
   INITIALIZATION
========================================================= */

async function initAdminDashboard() {
    try {
        const allowed = await checkAdminAccess();
        if (!allowed) return;

        renderAdminProfile();

        initAdminNavigation();
        initAdminFilters();
        initAdminModals();

        $("adminProfileForm")?.addEventListener(
            "submit",
            saveAdminProfile
        );

        $("profileAvatar")?.addEventListener(
            "change",
            uploadAdminAvatar
        );

        $("logoutButton")?.addEventListener(
            "click",
            logoutAdmin
        );

        await loadAdminData();

    } catch (error) {
        console.error("Admin initialization error:", error);
        showMessage(
            error.message || "Gagal memuat dashboard Admin.",
            true
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    initAdminDashboard
);
