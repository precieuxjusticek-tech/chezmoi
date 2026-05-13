/* ==================================================== */
/* ======== VERIFICATION DE LA MISE A JOUR ============ */
/* ==================================================== */
// Écouter les mises à jour du SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      showToast("info", "🔄 Mise à jour disponible ! Rechargement...");
      setTimeout(() => location.reload(true), 2000);
    }

    // Clic sur notification push → navigation intelligente
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      const { annonceId, typeAlerte, count } = event.data;
      if (count === 1 && annonceId) {
        // Charger l'annonce et aller sur détail
        fetch(`${API_URL}/api/annonces/${annonceId}`)
          .then(r => r.json())
          .then(annonce => {
            localStorage.setItem("annonceDetail", JSON.stringify(annonce));
            afficherPage("detail");
            afficherDetailAnnonce();
          })
          .catch(() => showToast("loadFail"));
      } else {
        // Aller sur alertes et ouvrir le bon onglet
        afficherPage("alertes");
        chargerPageAlertes();
        // Activer le bon onglet location ou vente
        const tab = typeAlerte === "vente" ? "vente" : "location";
        switchAlerteTab(tab);
      }
    }
  });
}

/* ===================================================== */
/* ================= VARIABLES GLOBALES ================= */
/* ===================================================== */
const API_URL = "https://chezmoi-backend.onrender.com";
let currentUserUid = null;
const savedUid = localStorage.getItem("uid");
if (savedUid) currentUserUid = savedUid;

let villeSelectionnee = "Toutes les villes";
let selectedImages = [];
let favorisLocal = [];

/* ===================================================== */
/* ======= bagde d'alertes dans la nav ================== */
/* ===================================================== */

function majBadgeAlertes() {
  const badge = document.getElementById("alertesNavBadge");
  if (!badge) return;

  const alerteLoc = localStorage.getItem("alerteChezMoi");
  const alerteVente = localStorage.getItem("alerteChezMoiVente");

  // Si aucune alerte n'existe, cacher le badge et nettoyer les données orphelines
  if (!alerteLoc) {
    localStorage.removeItem("biensAlerteTrouves");
    localStorage.removeItem("biensAlerteVusLoc");
  }
  if (!alerteVente) {
    localStorage.removeItem("biensAlerteTrouvesVente");
    localStorage.removeItem("biensAlerteVusVente");
  }

  // Si aucune alerte du tout, badge caché
  if (!alerteLoc && !alerteVente) {
    badge.classList.remove("visible");
    return;
  }

  const biensLoc = JSON.parse(localStorage.getItem("biensAlerteTrouves") || "[]");
  const biensVente = JSON.parse(localStorage.getItem("biensAlerteTrouvesVente") || "[]");
  const vusLoc = JSON.parse(localStorage.getItem("biensAlerteVusLoc") || "[]");
  const vusVente = JSON.parse(localStorage.getItem("biensAlerteVusVente") || "[]");

  const nouveauxLoc = alerteLoc ? biensLoc.filter(b => b.id && !vusLoc.includes(b.id)).length : 0;
  const nouveauxVente = alerteVente ? biensVente.filter(b => b.id && !vusVente.includes(b.id)).length : 0;

  badge.classList.toggle("visible", nouveauxLoc > 0 || nouveauxVente > 0);
}

/* ===================================================== */
/* ================= TOAST ============================= */
/* ===================================================== */
// Garde une trace du dernier toast affiché
let _lastToastKey = "";
let _lastToastTime = 0;

function showToast(type = "info", customMessage = "") {
  const messages = {
    offline: "⚠️ Vous êtes hors ligne.",
    loadFail: "❌ Échec du chargement. Veuillez réessayer.",
    success: "✅ Action effectuée avec succès !",
    formIncomplete: "⚠️ Veuillez remplir tous les champs requis.",
    serverDown: "⚠️ Le serveur ne répond pas. Réessayez plus tard.",
    clipboardSuccess: "✅ Lien copié dans le presse-papiers !",
    clipboardFail: "❌ Impossible de copier le lien.",
    imageMissing: "⚠️ Veuillez sélectionner au moins une image."
  };

  const message = messages[type] || customMessage;

  // Anti-doublon : même message dans les 3 dernières secondes → on ignore
  const now = Date.now();
  const key = type + "|" + message;
  if (key === _lastToastKey && now - _lastToastTime < 3000) return;
  _lastToastKey = key;
  _lastToastTime = now;

  let color;
  if (type === "success" || type === "clipboardSuccess") color = "#233d4c";
  else if (type === "error" || type === "loadFail" || type === "clipboardFail") color = "#c62828";
  else if (type === "info") color = "#fd802e";
  else color = "#fd802e";

  Toastify({
    text: message,
    duration: 3500,
    gravity: "bottom",
    position: "center",
    offset: { y: 80 },
    stopOnFocus: true,
    style: {
      background: color,
      borderRadius: "14px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      fontSize: "15px",
      fontWeight: "600",
      color: "#fff",
      padding: "12px 18px"
    }
  }).showToast();
}

// Détecte si une erreur est une erreur réseau/offline
function isNetworkError(err) {
  if (!navigator.onLine) return true;
  if (!err) return false;
  const msg = (err.message || err.toString()).toLowerCase();
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("networkerror") ||
    msg.includes("connection")
  );
}

function setupConnectionWatcher() {
  if (!navigator.onLine) showToast("info", "⚠️ Vous êtes hors ligne.");
  window.addEventListener('offline', () => showToast("info", "⚠️ Vous êtes hors ligne."));
  window.addEventListener('online', () => showToast("success", "✅ Connexion rétablie !"));
}
setupConnectionWatcher();

function verifierConnexion(actionLabel = "cette action") {
  if (!navigator.onLine) {
    showToast("info", `📵 Pas de connexion internet. Impossible d'effectuer ${actionLabel}.`);
    return false;
  }
  return true;
}

function getJoursRestants(expireAt) {
  if (!expireAt) return null;
  const now = new Date();
  const expireDate = new Date(expireAt._seconds * 1000);
  const diff = expireDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* ===================================================== */
/* ================= NAVIGATION ======================== */
/* ===================================================== */
const triggers = document.querySelectorAll("[data-page]");
const pages = document.querySelectorAll(".page");
const nav = document.querySelector(".app-nav");
const pagesSansNav = ["accueil", "inscription", "connexion", "recherche", "ajouter", "detail", "signalerProbleme", "proposerIdee"];

function updateIconActive(pageId) {
  document.querySelectorAll('.app-nav-item').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.app-nav-item[data-page="${pageId}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

function afficherPage(id) {
  const pageActive = document.querySelector(".page.active");
  if (pageActive && pageActive.id === "ajouter" && id !== "ajouter") resetFormulaire();

  pages.forEach(page => page.classList.remove("active"));

  const accueil = document.getElementById("accueil");
  if (accueil) accueil.style.display = (id === "accueil") ? "flex" : "none";

  const currentPage = document.getElementById(id);
  if (currentPage) currentPage.classList.add("active");
  if (nav) nav.style.display = pagesSansNav.includes(id) ? "none" : "flex";

  if (id === "home") afficherAnnoncesParGroupes(villeSelectionnee);
  if (!afficherPage.skipHistory) history.pushState({ page: id }, '', '#' + id);
  updateIconActive(id);
}

triggers.forEach(el => {
  el.addEventListener("click", () => {
    const pageId = el.getAttribute("data-page");
    // Protection pages nécessitant connexion
    const pagesProtegees = ["ajouter", "alertes", "favoris", "profil"];
    if (pagesProtegees.includes(pageId) && !currentUserUid) {
      showToast("info", "🔒 Vous devez être connecté pour accéder à cette page.");
      afficherPage("connexion");
      return;
    }
    afficherPage(pageId);
  });
});

window.addEventListener("DOMContentLoaded", async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const savedUid = localStorage.getItem("uid");
  if (savedUid) currentUserUid = savedUid;

  const hash = window.location.hash;
  if (hash.startsWith("#annonce-")) {
    const annonceId = hash.replace("#annonce-", "");
    try {
      const res = await fetch(`${API_URL}/api/annonces/${annonceId}`);
      if (!res.ok) throw new Error("Annonce introuvable");
      const annonce = await res.json();
      localStorage.setItem("annonceDetail", JSON.stringify(annonce));
      afficherPage("detail");
      afficherDetailAnnonce();
    } catch (err) {
      if (isNetworkError(err)) showToast("offline");
      else showToast("loadFail");
      afficherPage(savedUid ? "home" : "accueil");
    }
  } else {
    afficherPage(savedUid ? "home" : "accueil");
  }

  if (savedUid) {
    demanderNotifications(); // ✅ AJOUTER
  }
  majBadgeAlertes();
});

/* ===================================================== */
/* ============ SURVEILLANCE CONNEXION ================== */
/* ===================================================== */

let lastToastTime = 0;

function safeToast(type, message = "") {
  const now = Date.now();
  if (now - lastToastTime > 5000) {
    showToast(type, message);
    lastToastTime = now;
  }
}

let lastStatus = navigator.onLine;

function checkInstability() {
  if (navigator.onLine !== lastStatus) {
    safeToast("info", "⚠️ Connexion instable...");
    lastStatus = navigator.onLine;
  }
}

setInterval(checkInstability, 5000);

/* ===================================================== */
/* ================= FAVORIS ========================== */
/* ===================================================== */
async function toggleFavorite(uid, annonceId, isFavorite) {
  try {
    const url = `${API_URL}/api/favorites`;
    const response = await fetch(url, {
      method: isFavorite ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, annonceId })
    });
    if (!response.ok) throw new Error("Erreur serveur favoris");
    return !isFavorite;
  } catch (err) {
    showToast("loadFail");
    return isFavorite;
  }
}

function setupFavoriButton(btn, annonce) {
  let isFavorite = favorisLocal.includes(annonce.id);
  btn.textContent = isFavorite ? "❤️" : "🤍";
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!currentUserUid) { showToast("info", "Vous devez être connecté."); return; }
    isFavorite = await toggleFavorite(currentUserUid, annonce.id, isFavorite);
    if (isFavorite) { if (!favorisLocal.includes(annonce.id)) favorisLocal.push(annonce.id); }
    else { favorisLocal = favorisLocal.filter(id => id !== annonce.id); }
    btn.textContent = isFavorite ? "❤️" : "🤍";
    const favorisCount = document.getElementById("favorisCount");
    if (favorisCount) favorisCount.textContent = favorisLocal.length;
  });
}

/* ===================================================== */
/* ================= AFFICHAGE ANNONCES ================ */
/* ===================================================== */
function partagerAnnonce(annonce) {
  const url = `https://chezmoi-app.netlify.app#annonce-${annonce.id}`;
  const texte = `🚨 ${annonce.titre} : ${annonce.type_annonce} à ${annonce.ville} !\nPrix : ${annonce.prix} XAF\n👉 `;
  if (navigator.share) {
    navigator.share({ title: `ChezMoi: ${annonce.titre}`, text: texte, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => showToast("clipboardSuccess")).catch(() => showToast("clipboardFail"));
  }
}

async function afficherAnnoncesParGroupes(ville) {
  const container = document.getElementById("categoriesContainer");
  const spinner = document.getElementById("spinner");
  if (!container || !spinner) return;

  spinner.style.display = "flex";
  container.style.display = "none";

  try {
    const response = await fetch(`${API_URL}/api/annonces`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    if (!response.ok) throw new Error("Erreur serveur");
    const annonces = await response.json();

    const annoncesFiltrees = ville.toLowerCase() === "toutes les villes"
      ? annonces
      : annonces.filter(a => a.ville?.toLowerCase() === ville.toLowerCase());

    if (currentUserUid) {
      try {
        const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
        favorisLocal = await favRes.json();
      } catch { favorisLocal = []; }
    }

    container.innerHTML = "";

    if (annoncesFiltrees.length === 0) {
      spinner.style.display = "none";
      container.style.display = "block";
      container.innerHTML = `<p style="text-align:center;font-size:18px;margin-top:50px;">Aucune annonce publiée pour le moment.</p>`;
      return;
    }

    const groupedCategories = [
      ["studio", "appartement"],
      ["villa", "maison simple"],
      ["2-3-4 chambres et plus"],
      ["parcelle", "terrain"]
    ];

    groupedCategories.forEach(group => {
      const section = document.createElement("div");
      section.className = "categorie-section";

      const titreWrap = document.createElement("div");
      titreWrap.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:0 4px;";

      const titre = document.createElement("h3");
      titre.className = "categorie-title";
      titre.textContent = group.join(" & ");

      const voirTout = document.createElement("button");
      voirTout.textContent = "Voir tout →";
      voirTout.style.cssText = `
        background: linear-gradient(135deg, #fd802e, #ff5722);
        color: #fff;
        border: none;
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      `;
      voirTout.addEventListener("click", () => {
        const searchInput = document.getElementById("searchInput");
        const typeFilter = document.getElementById("typeFilter");
        if (searchInput) searchInput.value = "";
        if (typeFilter) {
          const firstType = group[0];
          const option = [...typeFilter.options].find(o => o.value.toLowerCase() === firstType.toLowerCase());
          if (option) typeFilter.value = option.value;
        }
        afficherPage("recherche");
      });

      titreWrap.appendChild(titre);
      titreWrap.appendChild(voirTout);
      section.appendChild(titreWrap);

      const row = document.createElement("div");
      row.className = "annonces-row";

      let annoncesDuo;
      if (group[0] === "2-3-4 chambres et plus") {
        annoncesDuo = annoncesFiltrees.filter(a => {
          const t = a.type_annonce?.toLowerCase();
          return t === "maison 2 chambre" || t === "maison 3 chambre" || t === "maison 4 chambre et plus";
        });
      } else {
        annoncesDuo = annoncesFiltrees.filter(a => group.some(c => a.type_annonce?.toLowerCase() === c.toLowerCase()));
      }

      if (annoncesDuo.length === 0) {
        row.innerHTML = `<p style="text-align:center;font-size:16px;margin-top:20px;">Aucune annonce pour ${group.join(" & ")}.</p>`;
      } else {
        annoncesDuo.forEach(annonce => {
          const joursRestants = getJoursRestants(annonce.expireAt);
          const card = document.createElement("div");
          card.className = "annonce-card";

          const imgs = annonce.images?.slice(0, 3) || [];
          if (imgs.length === 0) imgs.push("image/logo_ChezMoi.png");

          const slidesHTML = imgs.map((src, i) =>
            `<img class="card-slide" src="${src}" alt="${annonce.titre}" style="flex:0 0 100%;width:100%;height:160px;object-fit:cover;scroll-snap-align:start;">`
          ).join("");

          const dotsHTML = imgs.length > 1
            ? `<div class="card-dots">${imgs.map((_, i) => `<span class="card-dot${i===0?' active':''}"></span>`).join("")}</div>`
            : "";

          const navsHTML = imgs.length > 1
            ? `<button class="card-nav card-nav-prev">‹</button><button class="card-nav card-nav-next">›</button>`
            : "";

          card.innerHTML = `
            <div class="card-carousel" style="position:relative;overflow:hidden;border-radius:20px 20px 0 0;">
              <div class="card-slides" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;">
                ${slidesHTML}
              </div>
              ${dotsHTML}
              ${navsHTML}
              ${annonce.statut === "loue"
                ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);border-radius:20px 20px 0 0;display:flex;align-items:center;justify-content:center;z-index:8;">
                    <span style="background:#e53935;color:#fff;font-size:15px;font-weight:800;padding:8px 18px;border-radius:20px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(229,57,53,0.5);">🔒 LOUÉ</span>
                  </div>`
                : joursRestants !== null && joursRestants <= 7
                  ? `<div class="expire-info ${joursRestants <= 2 ? "urgent" : ""}">
                      ${joursRestants <= 2 ? `⚠ ${joursRestants}j` : `⏳ ${joursRestants}j`}
                    </div>` : ""}
            </div>
            <div class="annonce-content">
              <span class="annonce-type">${annonce.titre}</span>
              <span class="annonce-quartier">${annonce.quartier || ""}</span>
              <span class="annonce-type-text">${annonce.type_annonce || ""}</span>
            </div>
            <div class="annonce-footer">
              <div class="annonce-info">
                <span class="ville">${annonce.ville}</span>
                <span class="prix">${Number(annonce.prix).toLocaleString("fr-FR")} XAF</span>
              </div>
              <button class="btn-details">Voir →</button>
            </div>
            <button class="btn-fav" data-id="${annonce.id}">🤍</button>`;

          row.appendChild(card);

          const slidesEl = card.querySelector(".card-slides");
          const dots = card.querySelectorAll(".card-dot");

          function updateDots() {
            const idx = Math.round(slidesEl.scrollLeft / slidesEl.clientWidth);
            dots.forEach((d, i) => d.classList.toggle("active", i === idx));
          }
          slidesEl?.addEventListener("scroll", updateDots);

          card.querySelector(".card-nav-prev")?.addEventListener("click", (e) => {
            e.stopPropagation();
            slidesEl.scrollBy({ left: -slidesEl.clientWidth, behavior: "smooth" });
          });
          card.querySelector(".card-nav-next")?.addEventListener("click", (e) => {
            e.stopPropagation();
            slidesEl.scrollBy({ left: slidesEl.clientWidth, behavior: "smooth" });
          });

          card.querySelector(".btn-details").addEventListener("click", () => {
            localStorage.setItem("annonceDetail", JSON.stringify(annonce));
            afficherPage("detail");
            afficherDetailAnnonce();
          });

          const favBtn = card.querySelector(".btn-fav");
          favBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
          });
          setupFavoriButton(favBtn, annonce);
        });
      }

      section.appendChild(row);
      container.appendChild(section);
    });

    spinner.style.display = "none";
    container.style.display = "block";

  } catch (error) {
    spinner.style.display = "none";
    container.style.display = "block";
    container.innerHTML = `
      <div style="text-align:center;margin-top:50px;padding:20px;background:#ffe6e6;border-radius:10px;">
        <p style="font-size:18px;color:#cc0000;margin-bottom:20px;">⚠️ Erreur de chargement. Vérifiez votre connexion !</p>
        <button id="retryBtn" style="padding:10px 20px;font-size:16px;background:#233d4c;color:#fff;border:none;border-radius:5px;cursor:pointer;">🔄 Actualiser</button>
      </div>`;
    document.getElementById("retryBtn")?.addEventListener("click", () => location.reload());
    if (isNetworkError(error)) showToast("offline");
    else showToast("loadFail");
  }
}

/* ===================================================== */
/* ================= DROPDOWN VILLES ================== */
/* ===================================================== */
const dropbtn = document.querySelector(".dropbtn");
const dropdownContent = document.getElementById("cityDropdown");

if (dropbtn && dropdownContent) {
  dropbtn.addEventListener("click", () => {
    dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
  });
  window.addEventListener("click", (e) => {
    if (!e.target.matches(".dropbtn")) dropdownContent.style.display = "none";
  });
  dropdownContent.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      villeSelectionnee = a.textContent;
      dropbtn.textContent = villeSelectionnee + " ▼";
      dropdownContent.style.display = "none";
      afficherAnnoncesParGroupes(villeSelectionnee);
    });
  });
}

/* ===================================================== */
/* ================= PWA MULTI-PLATEFORME ============= */
/* ===================================================== */
let deferredPrompt;
const pwaPrompt = document.getElementById('pwaPrompt');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('dismissBtn');

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isAndroid = /android/i.test(navigator.userAgent);
const isDesktop = !isIOS && !isAndroid;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!isPwaInstalled()) setTimeout(showPwaPrompt, 2500);
});

function isPwaInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function showPwaPrompt() {
  if (isPwaInstalled()) return;
  if (isIOS || deferredPrompt || isDesktop) {
    pwaPrompt.style.display = "flex";
    setTimeout(() => pwaPrompt.classList.add("show"), 50);
    mettreAJourContenuPWA();
  }
}

function mettreAJourContenuPWA() {
  const titre = pwaPrompt.querySelector("h3");
  const texte = pwaPrompt.querySelector("p");
  const btn = document.getElementById("installBtn");

  if (isIOS) {
    if (titre) titre.textContent = "Installer ChezMoi sur iOS";
    if (texte) texte.innerHTML = `
      <div style="text-align:left;font-size:14px;line-height:1.8;">
        <p style="font-weight:700;color:#233d4c;margin-bottom:8px;">Suivez ces etapes :</p>
        <p>1. Appuyez sur <strong>Partager</strong> <span style="font-size:16px;">⬆️</span> en bas de Safari</p>
        <p>2. Choisissez <strong>"Sur l'ecran d'accueil"</strong> 📱</p>
        <p>3. Appuyez sur <strong>Ajouter</strong></p>
      </div>`;
    if (btn) btn.textContent = "Compris !";
  } else if (isAndroid) {
    if (titre) titre.textContent = "Installer ChezMoi";
    if (texte) texte.textContent = "Installez l'app pour un acces rapide et une meilleure experience.";
    if (btn) btn.textContent = "Installer";
  } else {
    if (titre) titre.textContent = "Installer ChezMoi";
    if (texte) texte.innerHTML = `
      <div style="text-align:left;font-size:14px;line-height:1.8;">
        <p>Cliquez sur <strong>Installer</strong> pour ajouter ChezMoi a votre bureau.</p>
        <p style="font-size:12px;color:#888;margin-top:6px;">Ou cliquez sur l'icone <strong>+</strong> dans la barre d'adresse de votre navigateur.</p>
      </div>`;
    if (btn) btn.textContent = "Installer";
  }
}

function hidePwaPrompt() {
  pwaPrompt.classList.remove("show");
  setTimeout(() => pwaPrompt.style.display = "none", 300);
}

installBtn?.addEventListener('click', async () => {
  if (isIOS) { hidePwaPrompt(); return; }
  hidePwaPrompt();
  if (!deferredPrompt) return;

  // Afficher loader
  const installLoader = document.getElementById("installLoader");
  if (installLoader) installLoader.style.display = "flex";

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;

  // Cacher loader
  if (installLoader) installLoader.style.display = "none";

  if (choice.outcome === "accepted") {
    showToast("info", "✅ ChezMoi installé ! Vous pouvez l'utiliser.");
  }
});

dismissBtn?.addEventListener('click', hidePwaPrompt);

document.addEventListener('DOMContentLoaded', () => {
  if (isPwaInstalled()) return;
  if (isIOS) {
    setTimeout(showPwaPrompt, 4000);
    setInterval(showPwaPrompt, 5 * 60 * 1000);
  } else if (isDesktop) {
    setTimeout(showPwaPrompt, 3000);
    setInterval(showPwaPrompt, 10 * 60 * 1000);
  }
});

/* ===================================================== */
/* ================= WIZARD AJOUTER =================== */
/* ===================================================== */
let currentStep = 1;
const totalSteps = 6;


function toggleChampsParcelle() {
  const typeChecked = document.querySelector('input[name="type"]:checked')?.value || "";
  const isParcelle = typeChecked === "parcelle" || typeChecked === "terrain";

  // Panel 4 : masquer/afficher équipements intérieurs
  const equipInterieurs = document.querySelectorAll(".equip-interieur");
  equipInterieurs.forEach(el => el.style.display = isParcelle ? "none" : "block");
  const parcelleInfo = document.querySelector(".parcelle-info");
  if (parcelleInfo) parcelleInfo.style.display = isParcelle ? "block" : "none";

  // Panel 5 : masquer/afficher champs normaux vs terrain
  const champsNormaux = document.getElementById("champsNonParcelle");
  if (champsNormaux) champsNormaux.style.display = isParcelle ? "none" : "block";
  const champsParcelle = document.getElementById("champsParcelle");
  if (champsParcelle) champsParcelle.style.display = isParcelle ? "block" : "none";

  // Gérer required
  const nbChambres = document.getElementById("nbChambres");
  const nbPieces = document.getElementById("nbPieces");
  const surfaceTerrain = document.getElementById("surfaceTerrain");
  if (nbChambres) nbChambres.required = !isParcelle;
  if (nbPieces) nbPieces.required = !isParcelle;
  if (surfaceTerrain) surfaceTerrain.required = isParcelle;
}

// Écouter changements du type de bien
document.querySelectorAll('input[name="type"]').forEach(radio => {
  radio.addEventListener("change", toggleChampsParcelle);
});

function goToStep(step) {
  document.getElementById(`panel-${currentStep}`).classList.remove("active");
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove("active");
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add("completed");

  const lines = document.querySelectorAll(".wizard-line");
  if (step > currentStep) lines[currentStep - 1].classList.add("completed");
  else { lines[step - 1].classList.remove("completed"); document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove("completed"); }

  currentStep = step;
  document.getElementById(`panel-${currentStep}`).classList.add("active");
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove("completed");
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add("active");

  document.getElementById("btnPrecedent").style.display = currentStep === 1 ? "none" : "block";
  document.getElementById("btnSuivant").style.display = currentStep === totalSteps ? "none" : "block";
  document.getElementById("btnPublier").style.display = currentStep === totalSteps ? "block" : "none";
  document.getElementById("ajouter").scrollTop = 0;

  // Recalculer les champs à chaque changement d'étape
  if (step === 4 || step === 5) toggleChampsParcelle();
}

function validerEtape(step) {
  if (step === 1 && !document.querySelector('input[name="titre"]:checked')) { showToast("info", "Choisissez un type d'annonce."); return false; }
  if (step === 2 && !document.querySelector('input[name="type"]:checked')) { showToast("info", "Choisissez un type de logement."); return false; }
  if (step === 3) {
    if (!document.querySelector('input[name="ville"]:checked')) { showToast("info", "Choisissez une ville."); return false; }
    if (!document.getElementById("quartier").value.trim()) { showToast("info", "Entrez le quartier."); return false; }
  }

  // BUG-1: Validation douche seulement si pas parcelle/terrain
  const typeChecked = document.querySelector('input[name="type"]:checked')?.value || "";
  const isParcelle = typeChecked === "parcelle" || typeChecked === "terrain";

  if (step === 4 && !isParcelle && !document.querySelector('input[name="douche"]:checked')) {
    showToast("info", "Choisissez le type de douche."); return false;
  }

  if (step === 5) {
    const prix = document.getElementById("prix").value;
    const description = document.getElementById("description").value.trim();
    const contact = document.getElementById("contactAnnonce").value.trim();

    if (!isParcelle) {
      const chambres = document.getElementById("nbChambres").value;
      const pieces = document.getElementById("nbPieces").value;
      if (!chambres || chambres < 0) { showToast("info", "Indiquez le nombre de chambres."); return false; }
      if (!pieces || pieces < 0) { showToast("info", "Indiquez le nombre de pièces."); return false; }
    } else {
      const surface = document.getElementById("surfaceTerrain").value;
      if (!surface || surface <= 0) { showToast("info", "Indiquez la surface du terrain."); return false; }
    }
  }  
  return true;
}

document.getElementById("btnSuivant")?.addEventListener("click", () => {
  // VENTE DÉSACTIVÉE — interception à l'étape 1
  if (currentStep === 1) {
    const titreSelectionne = document.querySelector('input[name="titre"]:checked')?.value;
    if (titreSelectionne === "Vente") {
      afficherModalVenteIndisponible();
      return;
    }
  }
  if (validerEtape(currentStep)) goToStep(currentStep + 1);
});
document.getElementById("btnPrecedent")?.addEventListener("click", () => goToStep(currentStep - 1));

/* ===================================================== */
/* ===== MODAL VENTE TEMPORAIREMENT INDISPONIBLE ======= */
/* ===================================================== */
// Pour réactiver la vente : supprimer l'appel à afficherModalVenteIndisponible()
// dans le listener btnSuivant et remettre l'option visible dans le HTML.

function afficherModalVenteIndisponible() {
  const existant = document.getElementById("modalVenteIndispo");
  if (existant) existant.remove();

  const modal = document.createElement("div");
  modal.id = "modalVenteIndispo";
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div style="
      background: #fff; border-radius: 24px;
      width: 100%; max-width: 420px;
      padding: 36px 28px 32px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.2);
      text-align: center;
      animation: fadeInScale 0.3s ease;
    ">
      <!-- ICÔNE -->
      <div style="
        width: 72px; height: 72px; border-radius: 50%;
        background: linear-gradient(135deg, #e8f4fd, #dbeeff);
        border: 2px solid rgba(30,100,220,0.15);
        display: flex; align-items: center; justify-content: center;
        font-size: 32px; margin: 0 auto 20px;
      ">🔧</div>

      <!-- BADGE -->
      <div style="
        display: inline-block; background: rgba(30,100,220,0.08);
        color: #1e64dc; border: 1px solid rgba(30,100,220,0.2);
        border-radius: 20px; padding: 4px 14px;
        font-size: 11px; font-weight: 700; letter-spacing: 0.6px;
        text-transform: uppercase; margin-bottom: 16px;
      ">Amélioration en cours</div>

      <!-- TITRE -->
      <h3 style="
        font-size: 20px; font-weight: 800; color: #1a1a1a;
        margin-bottom: 14px; line-height: 1.3;
      ">Les annonces de vente arrivent bientôt</h3>

      <!-- TEXTE -->
      <p style="
        font-size: 14px; color: #666; line-height: 1.75;
        margin-bottom: 24px;
      ">
        Nous travaillons activement à la mise en place d'un système de vente
        <strong style="color: #233d4c;">fiable, sécurisé et vérifié</strong>,
        conçu pour protéger aussi bien les vendeurs que les acheteurs.<br><br>
        Notre priorité est de vous offrir une expérience de confiance,
        <strong style="color: #233d4c;">sans risque d'arnaque</strong>.
        La fonctionnalité sera disponible très prochainement.
      </p>

      <!-- SÉPARATEUR -->
      <div style="
        display: flex; align-items: center; gap: 12px;
        margin-bottom: 20px; padding: 14px 16px;
        background: #f8f9fa; border-radius: 14px;
        border: 1px solid #efefef; text-align: left;
      ">
        <span style="font-size: 22px; flex-shrink: 0;">🔔</span>
        <span style="font-size: 13px; color: #555; line-height: 1.5;">
          En attendant, vous pouvez publier vos biens en <strong>location</strong>
          et être notifié dès que la vente est disponible.
        </span>
      </div>

      <!-- BOUTON FERMER -->
      <button id="btnFermerVenteIndispo" style="
        width: 100%; padding: 15px;
        background: linear-gradient(135deg, #233d4c, #2f5d73);
        color: #fff; border: none; border-radius: 14px;
        font-size: 15px; font-weight: 700; cursor: pointer;
        transition: all 0.2s ease;
      ">Compris, continuer en location</button>

      <p style="
        margin-top: 14px; font-size: 12px; color: #bbb;
      ">ChezMoi — Immobilier sécurisé au Congo</p>
    </div>`;

  document.body.appendChild(modal);

  // Fermeture
  document.getElementById("btnFermerVenteIndispo").onclick = () => {
    modal.remove();
    // Rebasculer automatiquement sur "Location"
    const radioLocation = document.getElementById("location");
    if (radioLocation) {
      radioLocation.checked = true;
      radioLocation.dispatchEvent(new Event("change"));
    }
  };

  // Fermer en cliquant sur l'overlay
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

function resetFormulaire() {
  const formAjouter = document.getElementById("formAjouter");
  if (formAjouter) formAjouter.reset();
  selectedFiles = [];

  renderGrid();
  if (currentStep !== 1) {
    document.getElementById(`panel-${currentStep}`)?.classList.remove("active");
    document.querySelector(`.wizard-step[data-step="${currentStep}"]`)?.classList.remove("active", "completed");
    currentStep = 1;
    document.getElementById("panel-1")?.classList.add("active");
    document.querySelector('.wizard-step[data-step="1"]')?.classList.add("active");
    document.querySelectorAll(".wizard-step").forEach(s => s.classList.remove("completed"));
    document.querySelectorAll(".wizard-line").forEach(l => l.classList.remove("completed"));
    document.getElementById("btnPrecedent").style.display = "none";
    document.getElementById("btnSuivant").style.display = "block";
    document.getElementById("btnPublier").style.display = "none";
  }

  // Réinitialiser l'affichage des champs
  toggleChampsParcelle();
}

/* ===================================================== */
/* ================= GOOGLE AUTH ====================== */
/* ===================================================== */

let _googleIdToken = null;
let _googlePendingMode = null;

async function loginAvecGoogle(mode) {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  sessionStorage.setItem("googleAuthMode", mode);

  try {
    const result = await firebase.auth().signInWithPopup(provider);
    await handleGoogleResult(result, mode);
  } catch (err) {
    if (err.code === "auth/popup-blocked" || err.code === "auth/unauthorized-domain" || err.code === "auth/operation-not-allowed") {
      try {
        await firebase.auth().signInWithRedirect(provider);
      } catch (redirectErr) {
        showToast("info", "⚠️ Connexion Google indisponible. Utilisez email/mot de passe.");
      }
    } else if (err.code === "auth/popup-closed-by-user") {
      return;
    } else {
      if (isNetworkError(err)) showToast("offline");
      else showToast("loadFail");
    }
  }
}

firebase.auth().getRedirectResult().then(async (result) => {
  if (!result || !result.user) return;
  const mode = sessionStorage.getItem("googleAuthMode") || "connexion";
  sessionStorage.removeItem("googleAuthMode");
  await handleGoogleResult(result, mode);
}).catch(() => {});

async function handleGoogleResult(result, mode) {
  const user = result.user;
  const idToken = await user.getIdToken();
  const nom = user.displayName || "";
  const email = user.email || "";

  if (mode === "inscription") {
    const nomInput = document.getElementById("ins-nom");
    const emailInput = document.getElementById("ins-email");
    if (nomInput) { nomInput.value = nom; nomInput.classList.add("google-prefilled"); }
    if (emailInput) { emailInput.value = email; emailInput.classList.add("google-prefilled"); }

    const pwdWrap = document.getElementById("ins-pwd-wrap");
    if (pwdWrap) pwdWrap.style.display = "none";
    const pwdInput = document.getElementById("ins-password");
    if (pwdInput) pwdInput.removeAttribute("required");

    _googleIdToken = idToken;
    document.getElementById("bannerInscription")?.classList.add("show");
    document.getElementById("ins-contact")?.focus();
    showToast("info", "✅ Infos Google importées ! Renseignez votre numéro.");

  } else {
    const loaderCon = document.getElementById("loader-connexion");
    if (loaderCon) loaderCon.style.display = "flex";
    try {
      const res = await fetch(`${API_URL}/api/google-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (loaderCon) loaderCon.style.display = "none";

      if (!res.ok) {
        if (data.message === "user_not_found" || data.message === "contact_required") {
          showToast("info", "Compte introuvable. Créez un compte d'abord !");
          _googleIdToken = idToken;
          afficherPage("inscription");
          return;
        }
        throw new Error(data.message);
      }

      currentUserUid = data.uid;
      localStorage.setItem("uid", data.uid);
      try { const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`); favorisLocal = await favRes.json(); }
      catch { favorisLocal = []; }
      showToast("info", "✅ Connecté avec Google !");
      afficherPage("home");
      // Charger les alertes depuis le compte
      try {
        const resAlertes = await fetch(`${API_URL}/api/alertes/${currentUserUid}`);
        const alertes = await resAlertes.json();
        if (alertes.location) localStorage.setItem("alerteChezMoi", JSON.stringify(alertes.location));
        if (alertes.vente) localStorage.setItem("alerteChezMoiVente", JSON.stringify(alertes.vente));
      } catch (e) {}
      demanderNotifications();

    } catch (err) {
      if (loaderCon) loaderCon.style.display = "none";
      if (isNetworkError(err)) showToast("offline");
      else showToast("loadFail");
    }
  }
}

document.getElementById("btnGoogleInscription")?.addEventListener("click", () => loginAvecGoogle("inscription"));
document.getElementById("btnGoogleConnexion")?.addEventListener("click", () => loginAvecGoogle("connexion"));

/* ===================================================== */
/* ================= INSCRIPTION ====================== */
/* ===================================================== */

const formInscription = document.getElementById("formInscription");
const loader = document.getElementById("loader");

formInscription?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loader.classList.add("show");

  const nom = document.getElementById("ins-nom").value.trim();
  const email = document.getElementById("ins-email").value.trim();
  const inscontact = document.getElementById("contact").value.trim();
  const role = document.querySelector('input[name="role"]:checked')?.value;

  if (!role) {
    loader.classList.remove("show");
    showToast("info", "⚠️ Veuillez sélectionner votre rôle.");
    return;
  }

  if (_googleIdToken) {
    try {
      const res = await fetch(`${API_URL}/api/google-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: _googleIdToken, inscontact, role })
      });
      const data = await res.json();
      loader.classList.remove("show");
      if (!res.ok) throw new Error(data.message);

      _googleIdToken = null;
      currentUserUid = data.uid;
      localStorage.setItem("uid", data.uid);
      try { const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`); favorisLocal = await favRes.json(); }
      catch { favorisLocal = []; }
      showToast("info", "🎉 Compte créé avec Google !");
      afficherPage("home");
    } catch (err) {
      loader.classList.remove("show");
      if (isNetworkError(err)) showToast("offline");
      else showToast("loadFail");
    }
    return;
  }

  const password = document.getElementById("ins-password").value;

  if (!nom || !email || !password || !inscontact) {
    loader.classList.remove("show");
    showToast("formIncomplete");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, email, password, inscontact, role })
    });
    const data = await res.json();
    loader.classList.remove("show");
    if (!res.ok) throw new Error(data.message || "Erreur inscription");

    showToast("info", "🎉 Inscription réussie !");
    currentUserUid = data.uid;
    localStorage.setItem("uid", data.uid);
    try { const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`); favorisLocal = await favRes.json(); }
    catch { favorisLocal = []; }
    afficherPage("home");

  } catch (err) {
    loader.classList.remove("show");
    showToast("info", `❌ ${err.message}`);
  }
});

/* ===================================================== */
/* ================= CONNEXION ======================== */
/* ===================================================== */

async function loginUser() {
  const email = document.getElementById("con-email").value.trim();
  const password = document.getElementById("con-password").value;
  const loaderCon = document.getElementById("loader-connexion");

  if (!email || !password) {
    showToast("formIncomplete");
    return;
  }

  try {
    loaderCon.style.display = "flex";

    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    loaderCon.style.display = "none";
    if (!res.ok) throw new Error(data.message || "Erreur connexion");

    showToast("info", "✅ Connexion réussie !");
    currentUserUid = data.uid;
    localStorage.setItem("uid", data.uid);
    try { const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`); favorisLocal = await favRes.json(); }
    catch { favorisLocal = []; }
    afficherPage("home");
    // Charger les alertes depuis le compte
    try {
      const resAlertes = await fetch(`${API_URL}/api/alertes/${currentUserUid}`);
      const alertes = await resAlertes.json();
      if (alertes.location) localStorage.setItem("alerteChezMoi", JSON.stringify(alertes.location));
      if (alertes.vente) localStorage.setItem("alerteChezMoiVente", JSON.stringify(alertes.vente));
    } catch (e) {}

    demanderNotifications();

  } catch (err) {
    loaderCon.style.display = "none";
    showToast("info", `❌ ${err.message}`);
  }
}

document.getElementById("formConnexion")?.addEventListener("submit", (e) => {
  e.preventDefault();
  loginUser();
});

/* ===================================================== */
/* ================= MOT DE PASSE OUBLIÉ ============= */
/* ===================================================== */
document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => {
  document.getElementById("resetModal").style.display = "flex";
});

document.getElementById("closeResetModal")?.addEventListener("click", () => {
  document.getElementById("resetModal").style.display = "none";
});

document.getElementById("sendResetBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("resetEmail").value.trim();
  if (!email) { showToast("formIncomplete"); return; }

  document.getElementById("loader-reset").style.display = "flex";
  try {
    const res = await fetch(`${API_URL}/api/password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    document.getElementById("loader-reset").style.display = "none";
    if (!res.ok) throw new Error(data.message);
    showToast("info", `✅ Email de réinitialisation envoyé à ${email}`);
    document.getElementById("resetModal").style.display = "none";
  } catch (err) {
    document.getElementById("loader-reset").style.display = "none";
    if (isNetworkError(err)) showToast("offline");
    else showToast("loadFail");
  }
});

/* ===================================================== */
/* ================= IMAGE GRID WIZARD ================ */
/* ===================================================== */
const imageGrid = document.getElementById("imageGrid");
const hiddenInput = document.getElementById("hiddenImageInput");
const imageCounter = document.getElementById("imageCounter");
const imageMax = document.getElementById("imageMax");
let selectedFiles = [];

if (hiddenInput) {
  hiddenInput.setAttribute("max", 15);
}

function updateImageCounter() {
  const maxImages = 15;
  if (imageCounter) imageCounter.textContent = selectedFiles.length;
  if (imageMax) imageMax.textContent = maxImages;
}

function renderGrid() {
  if (!imageGrid) return;
  imageGrid.innerHTML = "";
  const maxImages = 15;

  // Créer d'abord tous les slots vides pour préserver l'ordre
  const slots = selectedFiles.map(() => {
    const card = document.createElement("div");
    card.classList.add("image-card");
    imageGrid.appendChild(card);
    return card;
  });

  selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const card = slots[index];
      card.innerHTML = ""; // vider le slot

      const img = document.createElement("img");
      img.src = e.target.result;
      card.appendChild(img);
      img.addEventListener("click", (ev) => {
        ev.stopPropagation();
        afficherPleinEcran(e.target.result);
      });

      const btnSuppr = document.createElement("div");
      btnSuppr.classList.add("btnSuppr");
      btnSuppr.textContent = "✖";
      btnSuppr.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectedFiles.splice(index, 1);
        renderGrid();
        updateImageCounter();
      });
      card.appendChild(btnSuppr);
    };
    reader.readAsDataURL(file);
  });

  // Carte "+" pour ajouter
  if (selectedFiles.length < maxImages) {
    const plusCard = document.createElement("div");
    plusCard.classList.add("image-card", "plus");
    plusCard.textContent = "+";
    plusCard.addEventListener("click", () => hiddenInput.click());
    imageGrid.appendChild(plusCard);
  }
  updateImageCounter();
}

hiddenInput?.addEventListener("change", () => {
  if (!hiddenInput.files.length) return;
  const files = Array.from(hiddenInput.files);
  const maxImages = 15;

  for (let file of files) {
    const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!supported.includes(file.type)) { showToast("info", `Format non supporté: ${file.name}`); hiddenInput.value = ""; return; }
    if (file.size > 20 * 1024 * 1024) { showToast("info", `Image trop lourde: ${file.name}`); hiddenInput.value = ""; return; }
  }

  if (selectedFiles.length + files.length > maxImages) { showToast("info", `Tu peux ajouter maximum ${maxImages} images au total.`); }
  selectedFiles = [...selectedFiles, ...files].slice(0, maxImages);
  renderGrid();
  hiddenInput.value = "";
});

document.querySelectorAll('input[name="titre"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const locationFields = document.getElementById("locationOnlyFields");
    const venteFields = document.getElementById("venteOnlyFields");
    if (locationFields) locationFields.style.display = radio.value === "Location" ? "block" : "none";
    if (venteFields) venteFields.style.display = radio.value === "Vente" ? "block" : "none";
  });
});

document.querySelectorAll('input[name="cuisine"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const block = document.getElementById("typeCuisineBlock");
    if (block) block.style.display = radio.value === "oui" ? "block" : "none";
  });
});

document.querySelectorAll('input[name="disponibilite"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const block = document.getElementById("dispoDateBlock");
    if (block) block.style.display = radio.value === "date" ? "block" : "none";
  });
});

updateImageCounter();

/* ===================================================== */
/* ================= PLEIN ÉCRAN ====================== */
/* ===================================================== */
let overlayPleinEcran = null;

function afficherPleinEcran(src) {
  if (!overlayPleinEcran) {
    overlayPleinEcran = document.createElement("div");
    overlayPleinEcran.id = "overlayPleinEcran";
    Object.assign(overlayPleinEcran.style, { position: "fixed", top: "0", left: "0", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.9)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: "9999" });
    const img = document.createElement("img");
    img.id = "imagePleinEcran";
    img.style.maxWidth = "90%";
    img.style.maxHeight = "90%";
    overlayPleinEcran.appendChild(img);
    overlayPleinEcran.addEventListener("click", () => fermerPleinEcran());
    document.body.appendChild(overlayPleinEcran);
  }
  document.getElementById("imagePleinEcran").src = src;
  overlayPleinEcran.style.display = "flex";
  history.pushState({ fullscreen: true }, '', '#fullscreen');
}

function fermerPleinEcran(fromPopState = false) {
  if (!overlayPleinEcran) return;
  overlayPleinEcran.style.display = "none";
  if (!fromPopState && window.location.hash === "#fullscreen") history.back();
}

/* ===================================================== */
/* ================= COMPRESSION IMAGE ================ */
/* ===================================================== */
async function compressImage(file, maxSizeMB = 5) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const reader = new FileReader();
    reader.onload = (e) => img.src = e.target.result;
    img.onload = () => {
      let width = img.width, height = img.height;
      if (width > 900) { height *= 900 / width; width = 900; }
      canvas.width = width; canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.8;
      function tryCompress() {
        canvas.toBlob((blob) => {
          if (!blob) return reject("Erreur compression");
          if (blob.size / 1024 / 1024 <= maxSizeMB || quality <= 0.3) {
            resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
          } else { quality -= 0.1; tryCompress(); }
        }, "image/jpeg", quality);
      }
      tryCompress();
    };
    img.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/* ===================================================== */
/* ================= PUBLIER ANNONCE ================== */
/* ===================================================== */
const formAjouter = document.getElementById("formAjouter");
const chargementpub = document.getElementById("loader-pub");

formAjouter?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!verifierConnexion("la publication d'une annonce")) return;
  if (!currentUserUid) { showToast("info", "Vous devez être connecté."); afficherPage("inscription"); return; }

  const titre = document.querySelector('input[name="titre"]:checked')?.value;

  // SÉCURITÉ — Blocage vente côté logique (même si contournement interface)
  if (titre === "Vente") {
    afficherModalVenteIndisponible();
    return;
  }
  const type = document.querySelector('input[name="type"]:checked')?.value;
  const ville = document.querySelector('input[name="ville"]:checked')?.value;
  const quartier = document.getElementById("quartier").value.trim();
  const douche = document.querySelector('input[name="douche"]:checked')?.value;
  const prix = document.getElementById("prix").value;
  const description = document.getElementById("description").value.trim();
  const contact = document.getElementById("contactAnnonce").value.trim();

  const isParcelle = type === "parcelle" || type === "terrain";

  // BUG-1: Validation adaptée selon le type
  if (!titre || !type || !ville || !quartier || !prix || !description || !contact) { showToast("formIncomplete"); return; }
  if (!isParcelle && !douche) { showToast("formIncomplete"); return; }
  if (isNaN(prix) || prix <= 0) { showToast("info", "Veuillez entrer un prix valide supérieur à 0"); return; }
  if (selectedFiles.length === 0) { showToast("info", "Veuillez sélectionner au moins une image."); return; }

  chargementpub.style.display = "flex";
  chargementpub.querySelector("p").textContent = "Publication en cours...";
  // Mise à jour du message selon le nombre d'images
  if (selectedFiles.length > 5) {
    setTimeout(() => {
      if (chargementpub.style.display === "flex")
        chargementpub.querySelector("p").textContent = "Compression des images en cours... ⏳";
    }, 5000);
    setTimeout(() => {
      if (chargementpub.style.display === "flex")
        chargementpub.querySelector("p").textContent = "Envoi des photos... patience 📤";
    }, 20000);
    setTimeout(() => {
      if (chargementpub.style.display === "flex")
        chargementpub.querySelector("p").textContent = "Finalisation... encore quelques secondes 🏁";
    }, 50000);
  }

  try {
    const formData = new FormData();
    formData.append("uid", currentUserUid);
    formData.append("titre", titre);
    formData.append("type_annonce", type);
    formData.append("description", description);
    formData.append("prix", prix);
    formData.append("ville", ville);
    formData.append("quartier", quartier);
    formData.append("douche", isParcelle ? "" : (douche || ""));
    formData.append("contact", contact);
    formData.append("repere", document.getElementById("repere")?.value?.trim() || "");
    formData.append("nbChambres", isParcelle ? "" : (document.getElementById("nbChambres")?.value || ""));
    formData.append("nbPieces", isParcelle ? "" : (document.getElementById("nbPieces")?.value || ""));
    formData.append("nbSalons", isParcelle ? "" : (document.getElementById("nbSalons")?.value || ""));
    formData.append("surface", isParcelle
      ? (document.getElementById("surfaceTerrain")?.value || "")
      : (document.getElementById("surface")?.value || ""));
    formData.append("facade", isParcelle ? (document.getElementById("facade")?.value || "") : "");
    formData.append("etage", document.querySelector('input[name="etage"]:checked')?.value || "");
    formData.append("eau", document.querySelector('input[name="eau"]:checked')?.value || "");
    formData.append("electricite", document.querySelector('input[name="electricite"]:checked')?.value || "");
    formData.append("parking", document.querySelector('input[name="parking"]:checked')?.value || "");
    formData.append("gardien", document.querySelector('input[name="gardien"]:checked')?.value || "");
    formData.append("nbDouches", isParcelle ? "" : (document.getElementById("nbDouches")?.value || ""));

    // BUG-1 Champs spécifiques parcelle
    formData.append("type_sol", isParcelle ? (document.querySelector('input[name="type_sol"]:checked')?.value || "") : "");
    formData.append("voirie", isParcelle ? (document.querySelector('input[name="voirie"]:checked')?.value || "") : "");
    formData.append("cloture", isParcelle ? (document.querySelector('input[name="cloture"]:checked')?.value || "") : "");
    formData.append("viabilisee", isParcelle ? (document.querySelector('input[name="viabilisee"]:checked')?.value || "") : "");

    const chargesCocher = [];
    if (document.getElementById("chargesEau")?.checked) chargesCocher.push("eau");
    if (document.getElementById("chargesElec")?.checked) chargesCocher.push("electricite");
    formData.append("charges", chargesCocher.join(","));
    formData.append("climatiseur", isParcelle ? "" : (document.querySelector('input[name="climatiseur"]:checked')?.value || ""));
    formData.append("balcon", isParcelle ? "" : (document.querySelector('input[name="balcon"]:checked')?.value || ""));
    formData.append("groupe_electrogene", document.querySelector('input[name="groupe_electrogene"]:checked')?.value || "");
    formData.append("forage", document.querySelector('input[name="forage"]:checked')?.value || "");
    formData.append("cuisine", isParcelle ? "" : (document.querySelector('input[name="cuisine"]:checked')?.value || ""));
    formData.append("type_cuisine", isParcelle ? "" : (document.querySelector('input[name="type_cuisine"]:checked')?.value || ""));
    formData.append("caution", document.getElementById("caution")?.value || "");
    formData.append("avanceMax", document.getElementById("avanceMax")?.value || "");
    formData.append("toilettes", isParcelle ? "" : (document.querySelector('input[name="toilettes"]:checked')?.value || ""));
    formData.append("meuble", isParcelle ? "" : (document.querySelector('input[name="meuble"]:checked')?.value || ""));
    formData.append("disponibilite", document.querySelector('input[name="disponibilite"]:checked')?.value || "");
    formData.append("disponibiliteDate", document.getElementById("disponibiliteDate")?.value || "");
    formData.append("wifi", isParcelle ? "" : (document.querySelector('input[name="wifi"]:checked')?.value || ""));
    formData.append("fraisVisite", document.getElementById("fraisVisite")?.value || "");
    formData.append("commission", document.getElementById("commission")?.value?.trim() || "");
    formData.append("titre_propriete", document.querySelector('input[name="titre_propriete"]:checked')?.value || "");
    formData.append("negociable", document.querySelector('input[name="negociable"]:checked')?.value || "");
    formData.append("delai_vente", document.querySelector('input[name="delai_vente"]:checked')?.value || "");
    formData.append("statut", "published");
    formData.append("statut_numero", "verrouille");

    // ✅ APRÈS — compression parallèle, beaucoup plus rapide
    const compressedFiles = await Promise.all(
      selectedFiles.map(file => compressImage(file))
    );
    for (const compressedFile of compressedFiles) {
      formData.append("images", compressedFile);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // ✅ 3 minutes

    let annonceResponse;
    try {
      annonceResponse = await fetch(`${API_URL}/api/annonces`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      chargementpub.style.display = "none";
      if (fetchErr.name === "AbortError") {
        showToast("info", "⚠️ Délai dépassé (2 min). Réduisez le nombre d'images ou vérifiez votre réseau.");
      } else {
        showToast("offline");
      }
      return;
    }
    const annonceData = await annonceResponse.json();
    if (!annonceResponse.ok) throw new Error(annonceData.message);

    chargementpub.style.display = "none";
    showToast("info", "✅ Annonce publiée avec succès ! Elle sera visible 90 jours.");
    resetFormulaire();
    afficherPage("home");
    afficherAnnoncesParGroupes(villeSelectionnee);

  } catch (err) {
    if (isNetworkError(err)) showToast("offline");
    else showToast("loadFail");
    chargementpub.style.display = "none";
  }
});

renderGrid();
window.addEventListener("DOMContentLoaded", () => resetFormulaire());
window.addEventListener("beforeunload", () => resetFormulaire());

/* ===================================================== */
/* ================= DÉTAIL ANNONCE ======= */
/* ===================================================== */

async function afficherDetailAnnonce() {
  const data = localStorage.getItem("annonceDetail");
  if (!data) return;
  const annonce = JSON.parse(data);

  // Reset visuel temporaire en attendant la réponse API
  const btnDeb = document.getElementById("btnDebloquerContact");
  if (btnDeb) {
    btnDeb.disabled = true;
    btnDeb.style.opacity = "0.5";
    btnDeb.textContent = "⏳ Vérification...";
  }

  // === BADGE LOUÉ sur la page détail ===
  const existingLoueBadge = document.getElementById("detailLoueBadge");
  if (existingLoueBadge) existingLoueBadge.remove();

  if (annonce.statut === "loue") {
    // Badge dans la galerie
    const galleryWrap = document.querySelector(".detail-gallery-wrap");
    if (galleryWrap) {
      const loueBadge = document.createElement("div");
      loueBadge.id = "detailLoueBadge";
      loueBadge.style.cssText = `
        position:absolute;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.5);z-index:20;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
      `;
      const dateLoue = annonce.louéAt
        ? new Date(annonce.louéAt._seconds * 1000).toLocaleDateString("fr-FR", {day:"numeric",month:"long",year:"numeric"})
        : null;
      loueBadge.innerHTML = `
        <span style="background:#e53935;color:#fff;font-size:20px;font-weight:900;padding:10px 28px;border-radius:30px;box-shadow:0 6px 20px rgba(229,57,53,0.5);letter-spacing:1px;">🔒 BIEN LOUÉ</span>
        ${dateLoue ? `<span style="background:rgba(255,255,255,0.92);color:#333;font-size:13px;font-weight:700;padding:6px 16px;border-radius:20px;">Loué le ${dateLoue}</span>` : ""}
      `;
      galleryWrap.style.position = "relative";
      galleryWrap.appendChild(loueBadge);
    }

    // Désactiver le bloc contact entièrement
    const contactCard = document.getElementById("detailContactCard");
    if (contactCard) {
      contactCard.style.background = "linear-gradient(135deg,#2a2a2a,#1a1a1a)";
      contactCard.innerHTML = `
        <div style="text-align:center;padding:20px 10px;">
          <div style="font-size:40px;margin-bottom:12px;">🔒</div>
          <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;">Ce bien est loué</div>
          ${annonce.louéAt ? `<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:12px;">Loué le ${
            new Date(annonce.louéAt._seconds * 1000).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})
          }</div>` : ""}
          <div style="background:rgba(229,57,53,0.15);border:1px solid rgba(229,57,53,0.3);border-radius:12px;padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.75);line-height:1.6;">
            ✅ Ce logement a trouvé son locataire.<br>
            D'autres biens similaires sont disponibles !
          </div>
        </div>`;
    }

    // Masquer le bouton signaler
    const btnSignaler = document.getElementById("btnSignalerProbleme");
    if (btnSignaler) btnSignaler.style.display = "none";
  }

  const stateMsg = document.getElementById("contactStateMsg");
  if (stateMsg) stateMsg.style.display = "none";

  const expirationEl = document.getElementById("detailexpiration");
  const joursRestants = getJoursRestants(annonce.expireAt);
  const urgencyBar = document.getElementById("detailUrgencyBar");
  const urgencyText = document.getElementById("detailUrgencyText");

  if (expirationEl) {
    if (joursRestants !== null && joursRestants <= 0) {
      expirationEl.textContent = "❌ Annonce expirée";
      expirationEl.className = "detail-expire-badge expire-urgent";
    } else if (joursRestants !== null && joursRestants <= 2) {
      expirationEl.textContent = `⚠️ Expire dans ${joursRestants} jour(s)`;
      expirationEl.className = "detail-expire-badge expire-urgent";
      if (urgencyBar && urgencyText) {
        urgencyText.textContent = `⚡ Plus que ${joursRestants} jour(s) pour voir cette annonce !`;
        urgencyBar.style.display = "flex";
      }
    } else if (joursRestants !== null && joursRestants <= 7) {
      expirationEl.textContent = `⏳ Expire dans ${joursRestants} jour(s)`;
      expirationEl.className = "detail-expire-badge expire-warning";
    } else {
      expirationEl.textContent = "";
      expirationEl.className = "";
    }
  }

  const titrEl = document.getElementById("detailTitre");
  if (titrEl) titrEl.textContent = annonce.titre || "";

  const typeBadge = document.getElementById("detailTypeBadge");
  if (typeBadge) {
    typeBadge.textContent = annonce.type_annonce || "";
    typeBadge.className = "detail-type-badge " + ((annonce.titre || "").toLowerCase().includes("location") ? "location" : "vente");
  }

  const pricePeriod = document.getElementById("detailPricePeriod");
  if (pricePeriod) {
    pricePeriod.textContent = (annonce.titre || "").toLowerCase().includes("vente") ? "" : "/mois";
  }

  const villeQuartier = document.getElementById("detailVilleQuartier");
  if (villeQuartier) {
    const parts = [annonce.ville, annonce.quartier].filter(Boolean);
    villeQuartier.textContent = parts.join(", ");
  }

  const prixEl = document.getElementById("detailPrix");
  if (prixEl) {
    const prix = Number(annonce.prix);
    prixEl.textContent = prix ? prix.toLocaleString("fr-FR") : annonce.prix || "";
  }

  const descEl = document.getElementById("detailDescription");
  if (descEl) descEl.textContent = annonce.description || "Aucune description fournie.";

  /* BUG-2 FIX: Stats rapides adaptées selon le type de bien */
  const isParcelle = ["parcelle", "terrain"].includes(annonce.type_annonce?.toLowerCase());
  const quickStats = document.getElementById("detailQuickStats");
  if (quickStats) {
    quickStats.innerHTML = "";
    let stats;

    if (isParcelle) {
      // Stats spécifiques aux parcelles/terrains
      stats = [
        { icon: "📐", value: annonce.surface ? annonce.surface + " m²" : "—", label: "Surface" },
        { icon: "🏗️", value: annonce.viabilisee === "oui" ? "Oui" : annonce.viabilisee === "non" ? "Non" : "—", label: "Viabilisée" },
        { icon: "🧱", value: annonce.cloture === "oui" ? "Oui" : annonce.cloture === "non" ? "Non" : "—", label: "Clôturée" },
        { icon: "🛣️", value: annonce.voirie === "oui" ? "Oui" : annonce.voirie === "non" ? "Non" : "—", label: "Voirie" },
        { icon: "🌱", value: annonce.type_sol || "—", label: "Type de sol" },
      ];
    } else {
      stats = [
        { icon: "🛏️", value: annonce.nbChambres || "—", label: "Chambres" },
        { icon: "🚪", value: annonce.nbPieces || "—", label: "Pièces" },
        { icon: "🛋️", value: annonce.nbSalons || "—", label: "Salons" },
        { icon: "📐", value: annonce.surface ? annonce.surface + " m²" : "—", label: "Surface" },
        { icon: "🚿", value: annonce.nbDouches || "—", label: "Douches" },
      ];
    }

    stats.forEach(s => {
      const el = document.createElement("div");
      el.className = "detail-stat-item";
      el.innerHTML = `<span class="detail-stat-icon">${s.icon}</span><span class="detail-stat-value">${s.value}</span><span class="detail-stat-label">${s.label}</span>`;
      quickStats.appendChild(el);
    });
  }

  const locGrid = document.getElementById("detailLocalisationGrid");
  if (locGrid) {
    locGrid.innerHTML = "";
    const locFields = [
      { label: "Ville", value: annonce.ville },
      { label: "Quartier", value: annonce.quartier },
      { label: "Repère", value: annonce.repere || "Non précisé" },
      { label: "Étage", value: annonce.etage === "oui" ? "Oui, avec étage" : annonce.etage === "non" ? "Plain-pied" : "—" },
    ];
    locFields.forEach(f => {
      if (!f.value) return;
      const el = document.createElement("div");
      el.className = "detail-info-item";
      el.innerHTML = `<span class="info-label">${f.label}</span><span class="info-value">${f.value}</span>`;
      locGrid.appendChild(el);
    });
  }

  /* BUG-2 FIX: Équipements adaptés selon parcelle ou logement */
  const equipGrid = document.getElementById("detailEquipementsGrid");
  if (equipGrid) {
    equipGrid.innerHTML = "";
    const yesNo = (val) => val === "oui" ? "oui" : val === "non" ? "non" : null;

    let equipements;
    if (isParcelle) {
      equipements = [
        { icon: "💧", label: "Eau", val: yesNo(annonce.eau) },
        { icon: "⚡", label: "Électricité", val: yesNo(annonce.electricite) },
        { icon: "🔋", label: "Groupe élec.", val: yesNo(annonce.groupe_electrogene) },
        { icon: "🪣", label: "Forage/Puits", val: yesNo(annonce.forage) },
        { icon: "🚗", label: "Accès route", val: yesNo(annonce.voirie) },
        { icon: "🔒", label: "Gardien", val: yesNo(annonce.gardien) },
        { icon: "🧱", label: "Clôturée", val: yesNo(annonce.cloture) },
        { icon: "🏗️", label: "Viabilisée", val: yesNo(annonce.viabilisee) },
      ];
    } else {
      equipements = [
        { icon: "💧", label: "Eau", val: yesNo(annonce.eau) },
        { icon: "⚡", label: "Électricité", val: yesNo(annonce.electricite) },
        { icon: "🚿", label: `Douche (${annonce.douche || "—"})`, val: annonce.douche ? "oui" : null },
        { icon: "🚽", label: `Toilettes (${annonce.toilettes || "—"})`, val: annonce.toilettes ? "oui" : null },
        { icon: "❄️", label: "Climatiseur", val: yesNo(annonce.climatiseur) },
        { icon: "🌿", label: "Balcon/Terrasse", val: yesNo(annonce.balcon) },
        { icon: "🔋", label: "Groupe élec.", val: yesNo(annonce.groupe_electrogene) },
        { icon: "🪣", label: "Forage/Puits", val: yesNo(annonce.forage) },
        { icon: "🛋️", label: "Meublé", val: yesNo(annonce.meuble) },
        { icon: "📶", label: "WiFi", val: yesNo(annonce.wifi) },
        { icon: "🍳", label: annonce.type_cuisine ? `Cuisine (${annonce.type_cuisine})` : "Cuisine", val: yesNo(annonce.cuisine) },
        { icon: "🚗", label: "Parking", val: yesNo(annonce.parking) },
        { icon: "🔒", label: "Gardien", val: yesNo(annonce.gardien) },
      ];
    }

    equipements.forEach(eq => {
      if (eq.val === null) return;
      const el = document.createElement("div");
      el.className = `detail-equip-chip ${eq.val}`;
      
      const statusIcon = eq.val === "oui" ? "✅" : "❌";
      const statusText = eq.val === "oui" ? "Disponible" : "Absent";
      
      el.innerHTML = `
        <span class="equip-icon">${eq.icon}</span>
        <span class="equip-label">${eq.label}</span>
        <span class="equip-status">${statusIcon} ${statusText}</span>`;
      equipGrid.appendChild(el);
    });

    // ✅ Charges incluses — bien mis en évidence
    if (!isParcelle && annonce.charges) {
      const chargesArr = annonce.charges.split(",").filter(Boolean);
      if (chargesArr.length > 0) {
        const chargesLabels = chargesArr.map(c => c === "eau" ? "💧 Eau" : "⚡ Électricité").join(" + ");
        const el = document.createElement("div");
        el.className = "detail-equip-chip oui charges-incluses";
        el.innerHTML = `
          <span class="equip-icon">🧾</span>
          <span class="equip-label">Charges incluses avec le loyer !</span>
          <span class="equip-status" style="color:#2e7d32;font-weight:800;">${chargesLabels}</span>`;
        equipGrid.appendChild(el);
      }
    }

    if (!isParcelle && annonce.charges) {
      const chargesArr = annonce.charges.split(",").filter(Boolean);
      if (chargesArr.length > 0) {
        const el = document.createElement("div");
        el.className = "detail-equip-chip oui";
        el.innerHTML = `<span class="equip-icon">💡</span><span>Charges incluses</span><span>${chargesArr.map(c => c === "eau" ? "💧" : "⚡").join("")}</span>`;
        equipGrid.appendChild(el);
      }
    }
  }

  const isVente = (annonce.titre || "").toLowerCase().includes("vente");

  const condSection = document.getElementById("detailConditionsSection");
  const condGrid = document.getElementById("detailConditionsGrid");
  if (condSection && condGrid) {
    condGrid.innerHTML = "";

    if (isVente) {
      const hasVenteInfo = annonce.titre_propriete || annonce.negociable || annonce.delai_vente || annonce.fraisVisite;
      condSection.style.display = hasVenteInfo ? "block" : "none";
      condSection.querySelector("h3").textContent = "Conditions de vente";
      condSection.querySelector(".detail-section-icon").textContent = "🏠";

      if (annonce.titre_propriete) {
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">Titre de propriété</span><span class="info-value">${annonce.titre_propriete === "oui" ? "✅ Disponible" : "❌ Non disponible"}</span>`;
        condGrid.appendChild(el);
      }
      if (annonce.negociable) {
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">Prix négociable</span><span class="info-value">${annonce.negociable === "oui" ? "✅ Oui" : "❌ Non"}</span>`;
        condGrid.appendChild(el);
      }
      if (annonce.delai_vente) {
        const labels = { urgent: "🔥 Urgent", normal: "📅 Normal", flexible: "🕐 Flexible" };
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">Délai souhaité</span><span class="info-value">${labels[annonce.delai_vente] || annonce.delai_vente}</span>`;
        condGrid.appendChild(el);
      }
      if (annonce.fraisVisite) {
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">Frais de visite</span><span class="info-value">${Number(annonce.fraisVisite).toLocaleString("fr-FR")} XAF</span>`;
        condGrid.appendChild(el);
      }

      if (annonce.commission) {
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">🤝 Commission / Frais d'agence</span><span class="info-value">${annonce.commission}</span>`;
        condGrid.appendChild(el);
      }

    } else {
      const hasFinancial = annonce.caution || annonce.avanceMax || annonce.fraisVisite;
      condSection.style.display = hasFinancial ? "block" : "none";
      condSection.querySelector("h3").textContent = "Conditions financières";
      condSection.querySelector(".detail-section-icon").textContent = "💰";

      if (annonce.caution) {
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">Caution</span><span class="info-value">${annonce.caution} mois</span>`;
        condGrid.appendChild(el);
      }
      if (annonce.avanceMax) {
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">Avance max.</span><span class="info-value">${annonce.avanceMax} mois</span>`;
        condGrid.appendChild(el);
      }
      if (annonce.fraisVisite) {
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">Frais de visite</span><span class="info-value">${Number(annonce.fraisVisite).toLocaleString("fr-FR")} XAF</span>`;
        condGrid.appendChild(el);
      }

      if (annonce.commission) {
        const el = document.createElement("div");
        el.className = "detail-info-item";
        el.innerHTML = `<span class="info-label">🤝 Commission / Frais d'agence</span><span class="info-value">${annonce.commission}</span>`;
        condGrid.appendChild(el);
      }
    }
  }

  const dispoSection = document.getElementById("detailDispoSection");
  if (dispoSection) dispoSection.style.display = isVente ? "none" : "block";

  const dispoBadge = document.getElementById("detailDispoBadge");
  if (dispoBadge) {
    if (annonce.disponibilite === "maintenant") {
      dispoBadge.className = "detail-dispo-badge maintenant";
      dispoBadge.innerHTML = "⚡ Disponible maintenant";
    } else if (annonce.disponibilite === "date" && annonce.disponibiliteDate) {
      dispoBadge.className = "detail-dispo-badge date";
      const d = new Date(annonce.disponibiliteDate);
      dispoBadge.innerHTML = `📆 Disponible le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
    } else {
      dispoBadge.className = "detail-dispo-badge maintenant";
      dispoBadge.innerHTML = "⚡ Disponible";
    }
  }

  // ===== PROFIL AGENT =====
  const agentName = document.getElementById("detailAgentName");
  const agentAvatar = document.getElementById("detailAgentAvatar");
  const agentBadge = document.getElementById("detailAgentBadge");

  // Charger infos propriétaire
  if (annonce.uid) {
    fetch(`${API_URL}/api/user/${annonce.uid}`)
      .then(r => r.json())
      .then(user => {
        if (agentName) agentName.textContent = user.nom || "Agent ChezMoi";
        if (agentAvatar) {
          const initiale = (user.nom || "A").charAt(0).toUpperCase();
          agentAvatar.textContent = initiale;
          agentAvatar.style.background = "linear-gradient(135deg,#fd802e,#ff5722)";
          agentAvatar.style.color = "#fff";
          agentAvatar.style.fontSize = "22px";
          agentAvatar.style.fontWeight = "700";
        }
      })
      .catch(() => {
        if (agentName) agentName.textContent = "Agent ChezMoi";
      });
  }

  // ===== BULLE ROTATIVE =====
  demarrerBulleRotative();

  // ===== CLIC SUR PROFIL → PAGE AGENT =====
  const agentRow = document.getElementById("detailAgentRow");
  if (agentRow) {
    agentRow.onclick = () => ouvrirPageAgent(annonce.uid, annonce);
  }

  // ===== INITIALISATION STATUT CONTACT =====
  if (annonce.statut !== "loue") {
    getContactStatus(annonce.id, currentUserUid).then(status => {
      updateContactUI(status, annonce);
    });
  }

  // ===== BOUTON DÉBLOQUER =====
  if (btnDeb) {
    btnDeb.onclick = () => {
      if (!currentUserUid) {
        showToast("info", "🔒 Connectez-vous pour débloquer le contact.");
        afficherPage("connexion");
        return;
      }
      ouvrirModalDebloquer(annonce);
    };
  }

  const shareBtn = document.getElementById("detailShareBtn");
  if (shareBtn) shareBtn.onclick = () => partagerAnnonce(annonce);

  const imagesContainer = document.getElementById("detailImages");
  const paginationContainer = document.getElementById("sliderPagination");
  if (imagesContainer) imagesContainer.innerHTML = "";
  if (paginationContainer) paginationContainer.innerHTML = "";

  const images = annonce.images?.length ? annonce.images : ["image/logo_ChezMoi.png"];

  images.forEach((img, index) => {
    const imageEl = document.createElement("img");
    imageEl.src = img;
    imageEl.alt = annonce.titre;
    imagesContainer.appendChild(imageEl);
    imageEl.addEventListener("click", () => afficherImageFullscreen(img));

    const dot = document.createElement("span");
    if (index === 0) dot.classList.add("active");
    paginationContainer.appendChild(dot);
  });

  const indicator = document.getElementById("detailImagesIndicator");

  function updatePaginationAndIndicator() {
    const scrollLeft = imagesContainer.scrollLeft;
    const imageWidth = imagesContainer.clientWidth;
    const index = Math.round(scrollLeft / imageWidth);
    paginationContainer.querySelectorAll("span").forEach((dot, i) => dot.classList.toggle("active", i === index));
    if (indicator) indicator.textContent = `${index + 1} / ${images.length}`;
  }

  imagesContainer.addEventListener("scroll", updatePaginationAndIndicator);
  window.addEventListener("resize", updatePaginationAndIndicator);
  updatePaginationAndIndicator();
}

function afficherImageFullscreen(src) {
  let overlay = document.getElementById("imageFullscreenOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "imageFullscreenOverlay";
    Object.assign(overlay.style, {
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.9)", display: "flex",
      alignItems: "center", justifyContent: "center",
      zIndex: 9999, cursor: "pointer"
    });
    const fullscreenImg = document.createElement("img");
    fullscreenImg.id = "fullscreenImg";
    fullscreenImg.style.maxWidth = "90%";
    fullscreenImg.style.maxHeight = "90%";
    overlay.appendChild(fullscreenImg);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      // Ferme UNIQUEMENT le fullscreen, sans propager
      e.stopPropagation();
      fermerImageFullscreen();
    });

    if (!overlay._escListenerAdded) {
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") fermerImageFullscreen();
      });
      overlay._escListenerAdded = true;
    }
  }
  document.getElementById("fullscreenImg").src = src;
  overlay.style.display = "flex";

  // Ajoute une entrée dans l'historique UNIQUEMENT si pas déjà en fullscreen
  if (window.location.hash !== "#fullscreen") {
    history.pushState({ fullscreen: true }, '', '#fullscreen');
  }
}

function fermerImageFullscreen(fromPopState = false) {
  const overlay = document.getElementById("imageFullscreenOverlay");
  if (!overlay || overlay.style.display === "none") return;
  overlay.style.display = "none";

  // Retire #fullscreen de l'URL sans naviguer en arrière
  // sauf si c'est déjà le popstate qui gère ça
  if (!fromPopState && window.location.hash === "#fullscreen") {
    history.back(); // revient au state précédent (détail ou home)
  }
}

/* ===================================================== */
/* ============ SIGNALER UN PROBLÈME ================== */
/* ===================================================== */
document.getElementById("btnSignalerProbleme")?.addEventListener("click", () => {
  const annonce = JSON.parse(localStorage.getItem("annonceDetail") || "null");
  if (!annonce) { showToast("info", "Aucune annonce sélectionnée."); return; }
  localStorage.setItem("annonceProbleme", JSON.stringify(annonce));
  afficherPage("signalerProbleme");
});

document.getElementById("formSignalerProbleme")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid = localStorage.getItem("uid");
  if (!uid) { showToast("info", "Vous devez être connecté."); afficherPage("inscription"); return; }

  const description = document.getElementById("problemeDescription").value.trim();
  if (!description) { showToast("info", "Veuillez décrire le problème."); return; }

  const annonce = JSON.parse(localStorage.getItem("annonceProbleme") || "null");
  if (!annonce) { showToast("info", "Aucune annonce sélectionnée."); return; }

  const signalerLoader = document.getElementById("loader-signaler");
  signalerLoader.style.display = "flex";

  try {
    const userRes = await fetch(`${API_URL}/api/user/${uid}`);
    if (!userRes.ok) throw new Error("Impossible de récupérer les infos utilisateur");
    const user = await userRes.json();

    const res = await fetch(`${API_URL}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: user.nom, email: user.email,
        sujet: `Problème sur l'annonce : ${annonce.titre}`,
        message: description,
        annonce: { id: annonce.id, titre: annonce.titre, type: annonce.type_annonce, ville: annonce.ville, quartier: annonce.quartier, prix: annonce.prix }
      })
    });

    signalerLoader.style.display = "none";
    if (!res.ok) throw new Error("Erreur");
    showToast("success");
    document.getElementById("problemeDescription").value = "";
    localStorage.removeItem("annonceProbleme");
    afficherPage("home");
  } catch (err) {
    signalerLoader.style.display = "none";
    if (isNetworkError(err)) showToast("offline");
    else showToast("loadFail");
  }
});

/* ===================================================== */
/* ============ PROPOSER UNE IDÉE ==================== */
/* ===================================================== */
document.getElementById("formProposerIdee")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid = localStorage.getItem("uid");
  if (!uid) { showToast("info", "Vous devez être connecté."); afficherPage("inscription"); return; }

  const titre = document.getElementById("ideeTitre").value.trim();
  const description = document.getElementById("ideeDescription").value.trim();
  if (!titre || !description) { showToast("formIncomplete"); return; }

  const ideeLoader = document.getElementById("loader-idee");
  ideeLoader.style.display = "flex";

  try {
    const userRes = await fetch(`${API_URL}/api/user/${uid}`);
    const user = await userRes.json();
    const res = await fetch(`${API_URL}/api/idea`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: user.nom, email: user.email, sujet: titre, message: description })
    });
    ideeLoader.style.display = "none";
    if (!res.ok) throw new Error();
    showToast("info", "Merci pour votre idée ❤️");
    document.getElementById("ideeTitre").value = "";
    document.getElementById("ideeDescription").value = "";
    afficherPage("home");
  } catch {
    ideeLoader.style.display = "none";
    showToast("serverDown");
  }
});

/* ===================================================== */
/* ============ PAGE RECHERCHE ======================== */
/* ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const villeFilter = document.getElementById("villeFilter");
  document.getElementById("searchBtn")?.addEventListener("click", () => afficherPage("recherche"));
  const typeFilter = document.getElementById("typeFilter");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  let annonces = [];

  async function chargerAnnonces() {
    try {
      const response = await fetch(`${API_URL}/api/annonces`);
      if (!response.ok) throw new Error();
      annonces = await response.json();
      afficherAnnonces();
    } catch {
      if (searchResults) searchResults.innerHTML = `<p style="text-align:center;color:red;">Erreur de chargement.</p>`;
    }
  }

  function afficherAnnonces() {
    if (!searchResults) return;
    const ville = villeFilter.value.toLowerCase();
    const type = typeFilter.value.toLowerCase();
    const rechercheTexte = searchInput.value.toLowerCase().trim();
    const prixMaxInput = document.getElementById("prixFilter");
    const prixMax = prixMaxInput && prixMaxInput.value ? Number(prixMaxInput.value) : null;
    const resultCount = document.getElementById("searchResultCount");

    const aucunFiltre = ville === "toutes les villes" && type === "toutes les catégories" && rechercheTexte === "" && !prixMax;

    let annoncesAFiltrer = annonces;

    if (aucunFiltre) {
      annoncesAFiltrer = [];
      const categories = [...new Set(annonces.map(a => a.type_annonce))];
      categories.forEach(cat => {
        const cats = annonces.filter(a => a.type_annonce === cat);
        if (cats.length > 0) annoncesAFiltrer.push(cats[Math.floor(Math.random() * cats.length)]);
      });
      if (resultCount) resultCount.innerHTML = `<span>${annoncesAFiltrer.length}</span> annonces suggérées`;
    } else {
      annoncesAFiltrer = annonces.filter(a => {
        const villeOk = ville === "toutes les villes" || a.ville?.toLowerCase() === ville;
        const typeOk = type === "toutes les catégories" || a.type_annonce?.toLowerCase() === type;
        const prixOk = !prixMax || Number(a.prix) <= prixMax;
        const texteOk = !rechercheTexte ||
          a.ville?.toLowerCase().includes(rechercheTexte) ||
          a.quartier?.toLowerCase().includes(rechercheTexte) ||
          a.type_annonce?.toLowerCase().includes(rechercheTexte) ||
          String(a.prix).includes(rechercheTexte) ||
          a.description?.toLowerCase().includes(rechercheTexte);
        return villeOk && typeOk && texteOk && prixOk;
      });
      if (resultCount) resultCount.innerHTML = `<span>${annoncesAFiltrer.length}</span> résultat${annoncesAFiltrer.length > 1 ? "s" : ""} trouvé${annoncesAFiltrer.length > 1 ? "s" : ""}`;
    }

    searchResults.innerHTML = "";
    if (annoncesAFiltrer.length === 0) {
      searchResults.innerHTML = `<p>😔 Aucune annonce trouvée. Essayez d'autres critères.</p>`;
      return;
    }

    annoncesAFiltrer.forEach(annonce => {
      const joursRestants = getJoursRestants(annonce.expireAt);
      const card = document.createElement("div");
      card.className = "search-card";
      card.style.position = "relative"; // ← AJOUTER CETTE LIGNE
      const imgSrc = annonce.images?.[0] || "image/logo_ChezMoi.png";
      card.innerHTML = `
        <img src="${imgSrc}" alt="${annonce.titre}">
        ${annonce.statut === "loue"
          ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);border-radius:18px 18px 0 0;display:flex;align-items:center;justify-content:center;z-index:8;">
              <span style="background:#e53935;color:#fff;font-size:13px;font-weight:800;padding:6px 14px;border-radius:20px;">🔒 LOUÉ</span>
            </div>`
          : joursRestants !== null && joursRestants <= 7
            ? `<div class="expire-info ${joursRestants <= 2 ? "urgent" : ""}">
                ${joursRestants <= 2 ? `⚠ ${joursRestants}j` : `⏳ ${joursRestants}j`}
              </div>` : ""}
        <button class="btn-fav" data-id="${annonce.id}">🤍</button>
        <div class="search-card-content">
          <h3>${annonce.titre || "Logement"}</h3>
          <div class="card-infos">
            <p>🏠 ${annonce.type_annonce || ""}</p>
            <p>📍 ${annonce.ville || ""}${annonce.quartier ? " · " + annonce.quartier : ""}</p>
            <p class="prix">${annonce.prix ? Number(annonce.prix).toLocaleString("fr-FR") : ""} XAF</p>
          </div>
        </div>
        <div class="search-card-footer">
          <button class="btn-details">Voir →</button>
        </div>`;
      /* BUG-7 FIX: Bouton partager supprimé de la page recherche */

      card.querySelector(".btn-details").addEventListener("click", () => {
        localStorage.setItem("annonceDetail", JSON.stringify(annonce));
        afficherPage("detail");
        afficherDetailAnnonce();
      });
      setupFavoriButton(card.querySelector(".btn-fav"), annonce);
      searchResults.appendChild(card);
    });
  }

  villeFilter?.addEventListener("change", afficherAnnonces);
  typeFilter?.addEventListener("change", afficherAnnonces);
  searchInput?.addEventListener("input", afficherAnnonces);
  document.getElementById("prixFilter")?.addEventListener("input", afficherAnnonces);
  chargerAnnonces();
});

/* ===================================================== */
/* ============ PAGE ALERTES ========================== */
/* ===================================================== */

window.switchAlerteTab = function(tab) {
  document.getElementById("alerteTabLocation").style.display = tab === "location" ? "block" : "none";
  document.getElementById("alerteTabVente").style.display = tab === "vente" ? "block" : "none";
  document.getElementById("tabLocation").classList.toggle("active", tab === "location");
  document.getElementById("tabVente").classList.toggle("active", tab === "vente");
};

// Boutons ouvrir modale
document.getElementById("btnCreerAlerteLocation")?.addEventListener("click", () => ouvrirModaleAlerte("location", false));
document.getElementById("btnCreerAlerteBigLocation")?.addEventListener("click", () => ouvrirModaleAlerte("location", false));
document.getElementById("btnCreerAlerteVente")?.addEventListener("click", () => ouvrirModaleAlerte("vente", false));
document.getElementById("btnCreerAlerteBigVente")?.addEventListener("click", () => ouvrirModaleAlerte("vente", false));
document.getElementById("btnModifierAlerteLocation")?.addEventListener("click", () => ouvrirModaleAlerte("location", true));
document.getElementById("btnModifierAlerteVente")?.addEventListener("click", () => ouvrirModaleAlerte("vente", true));

document.getElementById("btnSupprimerAlerteLocation")?.addEventListener("click", () => {
  // Overlay de confirmation
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;";
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 24px;width:300px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.2);">
      <div style="font-size:36px;margin-bottom:12px;">🗑️</div>
      <p style="font-weight:700;font-size:16px;color:#233d4c;margin-bottom:8px;">Supprimer l'alerte ?</p>
      <p style="font-size:13px;color:#888;margin-bottom:20px;">Cette action est irréversible.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button id="overlayNon" style="padding:11px;border-radius:12px;border:1.5px solid #e0e0e0;background:#fff;color:#555;font-weight:600;cursor:pointer;">Annuler</button>
        <button id="overlayOui" style="padding:11px;border-radius:12px;border:none;background:linear-gradient(135deg,#e53935,#c62828);color:#fff;font-weight:700;cursor:pointer;">Supprimer</button>
      </div>
      <div id="spinnerSuppr" style="display:none;margin-top:16px;"><div class="spinner" style="margin:auto;"></div></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#overlayNon").onclick = () => overlay.remove();
  overlay.querySelector("#overlayOui").onclick = () => {
    overlay.querySelector("#spinnerSuppr").style.display = "block";
    overlay.querySelector("#overlayOui").disabled = true;
    overlay.querySelector("#overlayNon").disabled = true;
    setTimeout(() => {
      localStorage.removeItem("alerteChezMoi");
      localStorage.removeItem("biensAlerteTrouves");
      localStorage.removeItem("biensAlerteVusLoc");

      alerteLocale = null;
      afficherEtatAlerteLocation();
      afficherBiensTrouves();
      
      // Ajoute AVANT overlay.remove()
      if (currentUserUid) {
        fetch(`${API_URL}/api/alertes/${currentUserUid}/location`, { method: "DELETE" }).catch(() => {});
      }
      overlay.remove();
      showToast("info", "Alerte supprimée.");
    }, 800);
  };
});

document.getElementById("btnSupprimerAlerteVente")?.addEventListener("click", () => {
  // Overlay de confirmation
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;";
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 24px;width:300px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.2);">
      <div style="font-size:36px;margin-bottom:12px;">🗑️</div>
      <p style="font-weight:700;font-size:16px;color:#233d4c;margin-bottom:8px;">Supprimer l'alerte ?</p>
      <p style="font-size:13px;color:#888;margin-bottom:20px;">Cette action est irréversible.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button id="overlayNon" style="padding:11px;border-radius:12px;border:1.5px solid #e0e0e0;background:#fff;color:#555;font-weight:600;cursor:pointer;">Annuler</button>
        <button id="overlayOui" style="padding:11px;border-radius:12px;border:none;background:linear-gradient(135deg,#e53935,#c62828);color:#fff;font-weight:700;cursor:pointer;">Supprimer</button>
      </div>
      <div id="spinnerSuppr" style="display:none;margin-top:16px;"><div class="spinner" style="margin:auto;"></div></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#overlayNon").onclick = () => overlay.remove();
  overlay.querySelector("#overlayOui").onclick = () => {
    overlay.querySelector("#spinnerSuppr").style.display = "block";
    overlay.querySelector("#overlayOui").disabled = true;
    overlay.querySelector("#overlayNon").disabled = true;
    setTimeout(() => {
      localStorage.removeItem("alerteChezMoiVente");
      localStorage.removeItem("biensAlerteTrouvesVente");
      localStorage.removeItem("biensAlerteVusVente");
      alerteLocale = null;
      afficherEtatAlerteLocation();
      afficherBiensTrouves();
      // Ajoute AVANT overlay.remove()
      if (currentUserUid) {
        fetch(`${API_URL}/api/alertes/${currentUserUid}/vente`, { method: "DELETE" }).catch(() => {});
      }
      overlay.remove();
      showToast("info", "Alerte supprimée.");
    }, 800);
  };
});

let alerteLocale = JSON.parse(localStorage.getItem("alerteChezMoi") || "null");

document.getElementById("alertesBtn")?.addEventListener("click", () => {
  if (!currentUserUid) {
    afficherPage("inscription");
    return;
  }
  afficherPage("alertes");
  chargerPageAlertes();

  // Marquer tous les biens actuels comme "vus"
  const biensLoc = JSON.parse(localStorage.getItem("biensAlerteTrouves") || "[]");
  const biensVente = JSON.parse(localStorage.getItem("biensAlerteTrouvesVente") || "[]");
  localStorage.setItem("biensAlerteVusLoc", JSON.stringify(biensLoc.map(b => b.id)));
  localStorage.setItem("biensAlerteVusVente", JSON.stringify(biensVente.map(b => b.id)));

  // Retirer le badge
  const alertesBadge = document.getElementById("alertesNavBadge");
  if (alertesBadge) alertesBadge.classList.remove("visible");
});

function afficherOverlayAlertesBientot() {
  const existant = document.getElementById("overlayAlertesBientot");
  if (existant) return;

  const overlay = document.createElement("div");
  overlay.id = "overlayAlertesBientot";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(10, 20, 30, 0.75);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    animation: fadeIn 0.3s ease;
  `;

  overlay.innerHTML = `
    <div style="
      background: #fff;
      border-radius: 28px;
      width: 100%;
      max-width: 400px;
      overflow: hidden;
      box-shadow: 0 32px 80px rgba(0,0,0,0.25);
      animation: slideUpModal 0.4s cubic-bezier(.4,1.2,.5,1);
    ">

      <!-- BANDE HAUTE COLORÉE -->
      <div style="
        background: linear-gradient(135deg, #233d4c, #2f5d73);
        padding: 32px 28px 24px;
        text-align: center;
        position: relative;
        overflow: hidden;
      ">
        <div style="
          position: absolute; top: -40px; right: -40px;
          width: 120px; height: 120px; border-radius: 50%;
          background: rgba(253,128,46,0.12);
        "></div>

        <!-- ICÔNE -->
        <div style="
          width: 72px; height: 72px; border-radius: 50%;
          background: rgba(253,128,46,0.15);
          border: 2px solid rgba(253,128,46,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 34px; margin: 0 auto 18px;
        ">🔧</div>

        <!-- BADGE -->
        <div style="
          display: inline-block;
          background: rgba(253,128,46,0.18);
          color: #fd802e;
          border: 1px solid rgba(253,128,46,0.35);
          border-radius: 20px;
          padding: 4px 14px;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 14px;
        ">En cours d'amélioration</div>

        <h3 style="
          font-size: 20px; font-weight: 800;
          color: #ffffff; margin: 0;
          line-height: 1.3;
        ">Les alertes arrivent très bientôt</h3>
      </div>

      <!-- CORPS -->
      <div style="padding: 28px 28px 32px;">

        <!-- MESSAGE PRINCIPAL -->
        <p style="
          font-size: 14px; color: #444;
          line-height: 1.75; margin: 0 0 22px;
          text-align: center;
        ">
          Nous travaillons activement à vous offrir un système d'alertes
          <strong style="color: #233d4c;">fiable, rapide et vraiment utile</strong>
          — qui vous notifie en temps réel dès qu'un bien correspond
          exactement à ce que vous cherchez.
        </p>

        <!-- 3 POINTS RASSURANTS -->
        <div style="
          display: flex; flex-direction: column; gap: 12px;
          background: #f8f9fa;
          border-radius: 16px;
          padding: 18px 16px;
          margin-bottom: 24px;
          border: 1px solid #f0f0f0;
        ">
          ${[
            ["🔔", "Notification instantanée", "Soyez le 1er averti dès qu'un bien correspond à vos critères."],
            ["🎯", "Ciblage ultra-précis", "Quartier, budget, type de bien — zéro annonce inutile."],
            ["📱", "100% sur WhatsApp & app", "On vous prévient là où vous êtes, immédiatement."]
          ].map(([icon, titre, desc]) => `
            <div style="display:flex; align-items:flex-start; gap:12px;">
              <div style="
                width: 38px; height: 38px; flex-shrink: 0;
                border-radius: 10px;
                background: rgba(253,128,46,0.10);
                border: 1px solid rgba(253,128,46,0.2);
                display: flex; align-items: center; justify-content: center;
                font-size: 18px;
              ">${icon}</div>
              <div>
                <div style="font-size:13px; font-weight:700; color:#233d4c; margin-bottom:2px;">${titre}</div>
                <div style="font-size:12px; color:#888; line-height:1.5;">${desc}</div>
              </div>
            </div>
          `).join("")}
        </div>

        <!-- MESSAGE DE PATIENCE -->
        <div style="
          display: flex; align-items: center; gap: 10px;
          background: rgba(253,128,46,0.07);
          border: 1px solid rgba(253,128,46,0.2);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 22px;
        ">
          <span style="font-size: 20px; flex-shrink:0;">⏳</span>
          <span style="font-size: 13px; color: #c96b1a; font-weight: 600; line-height: 1.5;">
            En attendant, parcourez nos annonces — votre futur chez-soi est peut-être déjà là.
          </span>
        </div>

        <!-- BOUTON -->
        <button id="btnFermerOverlayAlertes" style="
          width: 100%; padding: 15px;
          background: linear-gradient(135deg, #233d4c, #2f5d73);
          color: #fff; border: none; border-radius: 14px;
          font-size: 15px; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease;
          letter-spacing: 0.2px;
        ">Voir les annonces disponibles</button>

        <p style="
          text-align: center; font-size: 11px;
          color: #ccc; margin-top: 14px;
        ">ChezMoi — L'immobilier de confiance au Congo 🇨🇬</p>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  document.getElementById("btnFermerOverlayAlertes").onclick = () => {
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.3s ease";
    setTimeout(() => {
      overlay.remove();
      afficherPage("home");
    }, 300);
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.3s ease";
      setTimeout(() => {
        overlay.remove();
        afficherPage("home");
      }, 300);
    }
  });
}

async function chargerPageAlertes() {
  if (!currentUserUid) return;

  // ===== OVERLAY ALERTES EN COURS DE TEST =====
  const existant = document.getElementById("overlayAlertesBientot");
  if (!existant) afficherOverlayAlertesBientot();
  return;
  // ============================================

  try {
    const res = await fetch(`${API_URL}/api/alertes/${currentUserUid}`);
    const alertes = await res.json();

    // Synchroniser avec les variables locales (pour le reste du code)
    alerteLocale = alertes.location || null;
    const alerteVenteData = alertes.vente || null;

    // Mettre à jour localStorage (lecture seule, pour compatibilité)
    if (alerteLocale) localStorage.setItem("alerteChezMoi", JSON.stringify(alerteLocale));
    else localStorage.removeItem("alerteChezMoi");

    if (alerteVenteData) localStorage.setItem("alerteChezMoiVente", JSON.stringify(alerteVenteData));
    else localStorage.removeItem("alerteChezMoiVente");

  } catch (e) {
    // Fallback sur localStorage si réseau coupé
    alerteLocale = JSON.parse(localStorage.getItem("alerteChezMoi") || "null");
  }

  afficherEtatAlerteLocation();
  afficherEtatAlerteVente();
  afficherBiensTrouves();
  verifierCorrespondances();
}

function afficherEtatAlerteLocation() {
  const empty = document.getElementById("alertesEmptyLocation");
  const card = document.getElementById("alerteCardLocation");
  const criteres = document.getElementById("alerteCriteresLocation");
  if (!alerteLocale) {
    if (empty) empty.style.display = "block";
    if (card) card.style.display = "none";
  } else {
    if (empty) empty.style.display = "none";
    if (card) card.style.display = "block";
    if (criteres) afficherCriteres(criteres, alerteLocale);
  }
}

function afficherEtatAlerteVente() {
  const alerteVente = JSON.parse(localStorage.getItem("alerteChezMoiVente") || "null");
  const empty = document.getElementById("alertesEmptyVente");
  const card = document.getElementById("alerteCardVente");
  const criteres = document.getElementById("alerteCriteresVente");
  if (!alerteVente) {
    if (empty) empty.style.display = "block";
    if (card) card.style.display = "none";
  } else {
    if (empty) empty.style.display = "none";
    if (card) card.style.display = "block";
    if (criteres) afficherCriteres(criteres, alerteVente);
  }
}

function afficherCriteres(container, alerte) {
  container.innerHTML = "";
  const chips = [
    { label: "📍 " + (alerte.ville || "Brazzaville") },
  ];
  if (alerte.typeAlerte) chips.push({ label: alerte.typeAlerte === "location" ? "🔑 Location" : "🏠 Vente" });
  if (alerte.quartiers?.length) chips.push({ label: "🏘️ " + alerte.quartiers.join(", ") });
  if (alerte.types?.length) chips.push({ label: "🏠 " + alerte.types.join(", ") });
  if (alerte.budgetMin || alerte.budgetMax) {
    const min = alerte.budgetMin ? Number(alerte.budgetMin).toLocaleString("fr-FR") : "0";
    const max = alerte.budgetMax ? Number(alerte.budgetMax).toLocaleString("fr-FR") : "illimité";
    chips.push({ label: `💰 ${min} - ${max} XAF` });
  }
  if (alerte.meuble) chips.push({ label: "🛋️ Meublé: " + alerte.meuble });
  if (alerte.wifi) chips.push({ label: "📶 WiFi: " + alerte.wifi });
  if (alerte.climatiseur) chips.push({ label: "❄️ Clim: " + alerte.climatiseur });
  if (alerte.negociable) chips.push({ label: "🤝 Négociable: " + alerte.negociable });
  if (alerte.viabilisee) chips.push({ label: "🏗️ Viabilisé: " + alerte.viabilisee });

  chips.forEach(c => {
    const chip = document.createElement("span");
    chip.className = "critere-chip";
    chip.textContent = c.label;
    container.appendChild(chip);
  });
}

function ouvrirModaleAlerte(typeAlerte, modeModif = false) {
  const modale = document.getElementById("modaleAlerte");
  const titre = document.getElementById("modaleAlerteTitre");
  if (!modale) return;

  // Mettre à jour le type dans le hidden input
  document.getElementById("alerteTypeAnnonce").value = typeAlerte;
  if (titre) titre.textContent = modeModif ? "Modifier mon alerte" : "Créer une alerte";

  // Mettre en surbrillance le bon onglet type dans la modale
  actualisserTypeModale(typeAlerte);

  // Réinitialiser les champs
  document.querySelectorAll("#alerteQuartiers input[type='checkbox']").forEach(cb => cb.checked = false);
  document.querySelectorAll("#alerteTypes input[type='checkbox']").forEach(cb => cb.checked = false);
  document.getElementById("alerteBudgetMin").value = "";
  document.getElementById("alerteBudgetMax").value = "";
  const meuble = document.getElementById("alerteMeuble");
  if (meuble) meuble.value = "";
  const caution = document.getElementById("alerteCaution");
  if (caution) caution.value = "";
  const wifi = document.getElementById("alerteWifi");
  if (wifi) wifi.value = "";
  const clim = document.getElementById("alerteClimatiseur");
  if (clim) clim.value = "";
  const neg = document.getElementById("alerteNegociable");
  if (neg) neg.value = "";
  const titreProp = document.getElementById("alerteTitreProp");
  if (titreProp) titreProp.value = "";
  const viab = document.getElementById("alerteViabilisee");
  if (viab) viab.value = "";
  const clot = document.getElementById("alerteCloture");
  if (clot) clot.value = "";

  // Pré-remplir si modification
  if (modeModif) {
    const storageKey = typeAlerte === "vente" ? "alerteChezMoiVente" : "alerteChezMoi";
    const alerte = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (alerte) {
      alerte.quartiers?.forEach(q => {
        const cb = document.querySelector(`#alerteQuartiers input[value="${q}"]`);
        if (cb) cb.checked = true;
      });
      alerte.types?.forEach(t => {
        const cb = document.querySelector(`#alerteTypes input[value="${t}"]`);
        if (cb) cb.checked = true;
      });
      if (alerte.budgetMin) document.getElementById("alerteBudgetMin").value = alerte.budgetMin;
      if (alerte.budgetMax) document.getElementById("alerteBudgetMax").value = alerte.budgetMax;
      if (alerte.meuble && meuble) meuble.value = alerte.meuble;
      if (alerte.cautionMax && caution) caution.value = alerte.cautionMax;
      if (alerte.wifi && wifi) wifi.value = alerte.wifi;
      if (alerte.climatiseur && clim) clim.value = alerte.climatiseur;
      if (alerte.negociable && neg) neg.value = alerte.negociable;
      if (alerte.viabilisee && viab) viab.value = alerte.viabilisee;
      if (alerte.cloture && clot) clot.value = alerte.cloture;
    }
  }

  modale.style.display = "flex";
}

function actualisserTypeModale(typeAlerte) {
  const isTerrain = typeAlerte === "terrain";
  const isVente = typeAlerte === "vente" || isTerrain;

  // Onglets visuels dans la modale
  const locBtn = document.getElementById("alerteTypeLoc");
  const venBtn = document.getElementById("alerteTypeVen");
  if (locBtn && venBtn) {
    const activeStyle = "border-color:#fd802e;background:rgba(253,128,46,0.08);color:#c96b1a;font-weight:700;";
    const inactiveStyle = "";
    locBtn.style.cssText = isVente ? inactiveStyle : activeStyle;
    venBtn.style.cssText = isVente ? activeStyle : inactiveStyle;
  }

  // Champs conditionnels
  const champLoc = document.getElementById("alerteChampLocation");
  const champVente = document.getElementById("alerteChampVente");
  const champTerrain = document.getElementById("alerteChampTerrain");
  const terrainCb = document.getElementById("alerteTypeTerrain");

  if (champLoc) champLoc.style.display = isVente ? "none" : "block";
  if (champVente) champVente.style.display = isVente ? "block" : "none";
  if (champTerrain) champTerrain.style.display = isTerrain ? "block" : "none";
  if (terrainCb) terrainCb.style.display = isTerrain ? "flex" : "none";
}

// Clic sur les onglets de type dans la modale
document.getElementById("alerteTypeLoc")?.addEventListener("click", () => {
  document.getElementById("alerteTypeAnnonce").value = "location";
  actualisserTypeModale("location");
});
document.getElementById("alerteTypeVen")?.addEventListener("click", () => {
  document.getElementById("alerteTypeAnnonce").value = "vente";
  actualisserTypeModale("vente");
});

function fermerModaleAlerte() {
  const modale = document.getElementById("modaleAlerte");
  if (modale) modale.style.display = "none";
}

document.getElementById("btnFermerModaleAlerte")?.addEventListener("click", fermerModaleAlerte);
document.getElementById("modaleAlerteOverlay")?.addEventListener("click", fermerModaleAlerte);

document.getElementById("btnEnregistrerAlerte")?.addEventListener("click", () => {
  const typeAlerte = document.getElementById("alerteTypeAnnonce")?.value || "location";

  // VENTE TEMPORAIREMENT DÉSACTIVÉE — blocage création alerte vente
  if (typeAlerte === "vente") {
    fermerModaleAlerte();
    afficherModalVenteIndisponible();
    return;
  }

  const key = typeAlerte === "vente" ? "alerteChezMoiVente" : "alerteChezMoi";
  const modeModif = document.getElementById("modaleAlerteTitre")?.textContent.includes("Modifier");

  // ✅ BUG-4 : Bloquer si alerte déjà existante et pas en mode modification
  if (!modeModif && localStorage.getItem(key)) {
    showToast("info", "⚠️ Vous avez déjà une alerte de ce type. Modifiez-la plutôt.");
    fermerModaleAlerte();
    return;
  }

  const quartiers = [...document.querySelectorAll("#alerteQuartiers input:checked")].map(cb => cb.value);
  const types = [...document.querySelectorAll("#alerteTypes input:checked")].map(cb => cb.value);
  const budgetMin = document.getElementById("alerteBudgetMin").value;
  const budgetMax = document.getElementById("alerteBudgetMax").value;
  const meuble = document.getElementById("alerteMeuble")?.value || "";
  const cautionMax = document.getElementById("alerteCaution")?.value || "";
  const wifi = document.getElementById("alerteWifi")?.value || "";
  const climatiseur = document.getElementById("alerteClimatiseur")?.value || "";
  const negociable = document.getElementById("alerteNegociable")?.value || "";
  const titreProp = document.getElementById("alerteTitreProp")?.value || "";
  const viabilisee = document.getElementById("alerteViabilisee")?.value || "";
  const cloture = document.getElementById("alerteCloture")?.value || "";

  const nouvelleAlerte = {
    userId: currentUserUid,
    typeAlerte,
    ville: "Brazzaville",
    quartiers, types,
    budgetMin: budgetMin ? Number(budgetMin) : null,
    budgetMax: budgetMax ? Number(budgetMax) : null,
    meuble: meuble || null,
    cautionMax: typeAlerte === "location" ? (cautionMax || null) : null,
    wifi: wifi || null,
    climatiseur: climatiseur || null,
    negociable: negociable || null,
    titre_propriete: titreProp || null,
    viabilisee: viabilisee || null,
    cloture: cloture || null,
    active: true,
    createdAt: new Date().toISOString()
  };

  localStorage.setItem(key, JSON.stringify(nouvelleAlerte));

  // ✅ Sauvegarder sur le serveur
  if (currentUserUid) {
    fetch(`${API_URL}/api/alertes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: currentUserUid, typeAlerte, alerte: nouvelleAlerte })
    }).catch(() => {}); // silencieux
  }
  if (typeAlerte === "location") alerteLocale = nouvelleAlerte;

  fermerModaleAlerte();
  afficherEtatAlerteLocation();
  afficherEtatAlerteVente();
  demanderNotifications();
  showToast("info", `✅ Alerte ${typeAlerte} enregistrée !`);
  verifierCorrespondancesParType(typeAlerte, nouvelleAlerte);
});

async function verifierCorrespondancesParType(typeAlerte, alerte) {
  if (!alerte) return;
  try {
    const res = await fetch(`${API_URL}/api/annonces`);
    if (!res.ok) return;
    const annonces = await res.json();

    const annoncesFiltered = annonces.filter(a => {
      const t = (a.titre || "").toLowerCase();
      if (typeAlerte === "location") return t.includes("location");
      if (typeAlerte === "vente") return t.includes("vente");
      return true;
    });

    const matches = annoncesFiltered.filter(a => correspondAlerte(a, alerte));
    const storageKey = typeAlerte === "vente" ? "biensAlerteTrouvesVente" : "biensAlerteTrouves";
    let biensExistants = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const ancienIds = biensExistants.map(b => b.id);

    let nouveaux = 0;
    matches.forEach(a => {
      if (!ancienIds.includes(a.id)) {
        biensExistants.unshift({ ...a, trouveLe: new Date().toISOString() });
        nouveaux++;
      }
    });

    if (nouveaux > 0) {
      localStorage.setItem(storageKey, JSON.stringify(biensExistants));
      if (typeAlerte === "location") alerteLocale = JSON.parse(localStorage.getItem("alerteChezMoi") || "null");
      afficherBiensTrouves();
      showToast("info", `🔔 ${nouveaux} nouveau${nouveaux > 1 ? 'x' : ''} bien${nouveaux > 1 ? 's' : ''} trouvé${nouveaux > 1 ? 's' : ''} !`);
      
      const badge = typeAlerte === "vente"
        ? document.getElementById("alertesBadgeNewVente")
        : document.getElementById("alertesBadgeNewLocation");
      if (badge) {
        badge.textContent = nouveaux + " nouveau" + (nouveaux > 1 ? "x" : "");
        badge.style.display = "inline-block";
      }

      // Notification push
      if ('Notification' in window && Notification.permission === 'granted') {
        const premierBien = biensExistants[0];
        const labelType = typeAlerte === "vente" ? "Vente" : "Location";
        const titreNotif = `ChezMoi 🔔 — Alerte ${labelType}`;
        const bodyNotif = nouveaux === 1
          ? `1 bien : ${premierBien?.type_annonce || ""} à ${premierBien?.ville || ""} — ${premierBien?.prix ? Number(premierBien.prix).toLocaleString("fr-FR") + " XAF" : ""}`
          : `${nouveaux} nouveaux biens correspondent à votre alerte ${labelType} !`;

        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(titreNotif, {
            body: bodyNotif,
            icon: '/icons/chezmoi_icon256.png',
            badge: '/icons/chezmoi_icon256.png',
            data: { annonceId: nouveaux === 1 ? premierBien?.id : null, typeAlerte, count: nouveaux },
            vibrate: [200, 100, 200]
          });
        }).catch(() => {
          new Notification(titreNotif, { body: bodyNotif, icon: '/icons/chezmoi_icon256.png' });
        });
      }

      majBadgeAlertes();
    } else {
      const biensActuels = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (biensActuels.length === 0) {
        showToast("info", "✅ Alerte créée ! Aucun bien correspondant pour l'instant.");
      }
      afficherBiensTrouves();
      majBadgeAlertes();
    }
  } catch { /* silencieux */ }
}

async function verifierCorrespondances() {
  alerteLocale = JSON.parse(localStorage.getItem("alerteChezMoi") || "null");
  if (alerteLocale) verifierCorrespondancesParType("location", alerteLocale);
  const alerteVente = JSON.parse(localStorage.getItem("alerteChezMoiVente") || "null");
  if (alerteVente) verifierCorrespondancesParType("vente", alerteVente);
}

function correspondAlerte(annonce, alerte) {
  if (annonce.ville?.toLowerCase() !== "brazzaville") return false;
  if (alerte.quartiers?.length) {
    const q = (annonce.quartier || "").toLowerCase();
    if (!alerte.quartiers.some(aq => q.includes(aq.toLowerCase()))) return false;
  }
  if (alerte.types?.length) {
    if (!alerte.types.some(t => annonce.type_annonce?.toLowerCase() === t.toLowerCase())) return false;
  }
  const prix = Number(annonce.prix);
  if (alerte.budgetMin && prix < alerte.budgetMin) return false;
  if (alerte.budgetMax && prix > alerte.budgetMax) return false;
  if (alerte.meuble && annonce.meuble && alerte.meuble !== annonce.meuble) return false;
  if (alerte.wifi && annonce.wifi && alerte.wifi !== annonce.wifi) return false;
  if (alerte.climatiseur && annonce.climatiseur && alerte.climatiseur !== annonce.climatiseur) return false;
  if (alerte.negociable && annonce.negociable && alerte.negociable !== annonce.negociable) return false;
  if (alerte.viabilisee && annonce.viabilisee && alerte.viabilisee !== annonce.viabilisee) return false;
  if (alerte.cautionMax && annonce.caution) {
    if (Number(annonce.caution) > Number(alerte.cautionMax)) return false;
  }
  return true;
}

function afficherBiensTrouves() {
  const containerLoc = document.getElementById("alertesBiensContainerLocation");
  const emptyLoc = document.getElementById("alertesBiensEmptyLocation");
  const biensLocation = JSON.parse(localStorage.getItem("biensAlerteTrouves") || "[]");
  if (containerLoc) {
    containerLoc.innerHTML = "";
    if (biensLocation.length === 0) {
      if (emptyLoc) emptyLoc.style.display = "block";
    } else {
      if (emptyLoc) emptyLoc.style.display = "none";
      biensLocation.forEach(bien => renderBienCard(bien, containerLoc));
    }
  }

  const containerVente = document.getElementById("alertesBiensContainerVente");
  const emptyVente = document.getElementById("alertesBiensEmptyVente");
  const biensVente = JSON.parse(localStorage.getItem("biensAlerteTrouvesVente") || "[]");
  if (containerVente) {
    containerVente.innerHTML = "";
    if (biensVente.length === 0) {
      if (emptyVente) emptyVente.style.display = "block";
    } else {
      if (emptyVente) emptyVente.style.display = "none";
      biensVente.forEach(bien => renderBienCard(bien, containerVente));
    }
  }
}

function renderBienCard(bien, container) {
  const card = document.createElement("div");
  card.className = "bien-trouve-card";
  const imgSrc = bien.images?.[0] || "image/logo_ChezMoi.png";
  const temps = tempsEcoule(bien.trouveLe);
  card.innerHTML = `
    <img class="bien-trouve-img" src="${imgSrc}" alt="${bien.titre}">
    <div class="bien-trouve-body">
      <div>
        <span class="bien-trouve-badge">${bien.titre || "Annonce"}</span>
        <div class="bien-trouve-type">${bien.type_annonce || ""}</div>
        <div class="bien-trouve-loc">📍 ${bien.ville || ""}${bien.quartier ? " · " + bien.quartier : ""}</div>
      </div>
      <div class="bien-trouve-footer">
        <div>
          <div class="bien-trouve-prix">${bien.prix ? Number(bien.prix).toLocaleString("fr-FR") : ""} XAF</div>
          <div class="bien-trouve-time">Trouvé ${temps}</div>
        </div>
        <button class="btn-voir-bien">Voir →</button>
      </div>
    </div>`;
  card.querySelector(".btn-voir-bien").addEventListener("click", () => {
    localStorage.setItem("annonceDetail", JSON.stringify(bien));
    afficherPage("detail");
    afficherDetailAnnonce();
  });
  container.appendChild(card);
}

// ==========================
// DEMANDE DE PUSH
// ==========================
// ===== CLÉ PUBLIQUE VAPID (copie depuis ton .env) =====
const VAPID_PUBLIC_KEY = "BBMHyJa3PtdH488j45q5lx9ThEGbo4cubGt3ojdrc205T1ojr-4JMH20Mrylyod48uod5btMpJYwEJrb_K3R-hw";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

async function demanderNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!currentUserUid) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;

    // Vérifier si déjà souscrit
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Envoyer au backend
    await fetch(`${API_URL}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: currentUserUid, subscription })
    });

  } catch (err) {
    console.error("Erreur subscription push:", err);
  }
}

function tempsEcoule(dateIso) {
  if (!dateIso) return "";
  const diff = Date.now() - new Date(dateIso).getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const j = Math.floor(diff / 86400000);
  if (j > 0) return `il y a ${j}j`;
  if (h > 0) return `il y a ${h}h`;
  if (min > 0) return `il y a ${min} min`;
  return "à l'instant";
}

/* ===================================================== */
/* ============ PAGE PROFIL =========================== */
/* ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const profileBtn = document.getElementById("profileBtn");
  const profilchargement = document.getElementById("loader-profil");

  profileBtn?.addEventListener("click", async () => {
    if (!currentUserUid) { showToast("info", "Vous devez être connecté."); afficherPage("inscription"); return; }
    afficherPage("profil");
    profilchargement.style.display = "flex";

    // Afficher depuis le cache localStorage si disponible
    const cachedUser = localStorage.getItem("userProfile");
    if (cachedUser) {
      const u = JSON.parse(cachedUser);
      document.getElementById("userName").textContent = u.nom || "Utilisateur";
      document.getElementById("userEmail").textContent = u.email || "-";
      document.getElementById("userContact").textContent = u.inscontact || "Non renseigné";
      const rolesLabels = { locataire: "🏠 Locataire", agent: "💼 Agent", proprietaire: "🔑 Propriétaire" };
      document.getElementById("userRole").textContent = rolesLabels[u.role] || "Non renseigné";
    }

    try {
      const resUser = await fetch(`${API_URL}/api/user/${currentUserUid}`);
      if (!resUser.ok) throw new Error();
      const user = await resUser.json();

      // Sauvegarder en cache
      localStorage.setItem("userProfile", JSON.stringify(user));

      document.getElementById("userName").textContent = user.nom || "Utilisateur";
      document.getElementById("userEmail").textContent = user.email || "-";
      document.getElementById("userContact").textContent = user.inscontact || "Non renseigné";
      const rolesLabels = { locataire: "🏠 Locataire", agent: "💼 Agent", proprietaire: "🔑 Propriétaire" };
      document.getElementById("userRole").textContent = rolesLabels[user.role] || "Non renseigné";

      const resFav = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
      const favoris = await resFav.json();
      document.getElementById("favorisCount").textContent = favoris.length;

      const resAnnonces = await fetch(`${API_URL}/api/annonces/user/${currentUserUid}`);
      const annonces = await resAnnonces.json();
      const container = document.getElementById("userAnnoncesContainer");
      container.innerHTML = "";
      document.getElementById("userAnnonces").textContent = annonces.length;

      if (annonces.length === 0) {
        container.innerHTML = "<p>Aucune annonce publiée.</p>";
      } else {
        annonces.forEach(annonce => {
          const joursRestants = getJoursRestants(annonce.expireAt);
          const card = document.createElement("div");
          card.className = "annonce-card";
          card.style.cssText = "width:200px;border:1px solid #ddd;border-radius:8px;overflow:hidden;cursor:pointer;";
          const imgSrc = annonce.images?.[0] || "image/logo_ChezMoi.png";
          card.innerHTML = `
            <div style="height:120px;overflow:hidden;"><img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;"></div>
            ${joursRestants !== null && joursRestants <= 7 ? `<div class="expire-info ${joursRestants <= 2 ? "urgent" : ""}">⏳ ${joursRestants} j.</div>` : ""}
            <div style="padding:10px;">
              <div style="font-weight:bold;font-size:16px;">${annonce.titre}</div>
              <div style="color:#555;font-size:14px;">${annonce.ville}</div>
              <div style="font-weight:bold;margin-top:5px;">${annonce.prix} XAF</div>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn-modifier" style="flex:1;padding:6px;background:#233d4c;color:#fd802e;border:none;border-radius:5px;cursor:pointer;font-size:13px;">✏️ Modifier</button>
                <button class="btn-delete" style="flex:1;padding:6px;background:#e74c3c;color:white;border:none;border-radius:5px;cursor:pointer;font-size:13px;">🗑️ Suppr.</button>
              </div>
            </div>`;

          /* BUG-6 FIX: Bouton modifier annonce depuis profil */
          card.querySelector(".btn-modifier").addEventListener("click", (e) => {
            e.stopPropagation();
            ouvrirModalModifierAnnonce(annonce);
          });

          card.querySelector(".btn-delete").addEventListener("click", (e) => {
            e.stopPropagation();
            if (document.querySelector(".confirm-overlay")) return;
            const overlay = document.createElement("div");
            overlay.className = "confirm-overlay";
            overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;";
            overlay.innerHTML = `<div style="background:#fff;padding:20px;border-radius:10px;text-align:center;width:300px;"><p style="margin-bottom:15px;">Supprimer cette annonce ?</p><button class="yes-btn" style="background:#e74c3c;color:white;border:none;padding:8px 15px;border-radius:5px;margin-right:10px;cursor:pointer;">Oui</button><button class="no-btn" style="background:#ccc;border:none;padding:8px 15px;border-radius:5px;cursor:pointer;">Non</button></div>`;
            document.body.appendChild(overlay);
            overlay.querySelector(".no-btn").onclick = () => overlay.remove();
            overlay.querySelector(".yes-btn").onclick = async () => {
              try {
                const res = await fetch(`${API_URL}/api/annonces/${annonce.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: currentUserUid }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                showToast("info", "Annonce supprimée !");
                card.remove();
                const compteur = document.getElementById("userAnnonces");
                if (compteur) compteur.textContent = Number(compteur.textContent) - 1;

                // ✅ BUG 1 FIX — Nettoyer partout
                favorisLocal = favorisLocal.filter(id => id !== annonce.id);
                const favorisCount = document.getElementById("favorisCount");
                if (favorisCount) favorisCount.textContent = favorisLocal.length;

                // Nettoyer les alertes localStorage
                ["biensAlerteTrouves", "biensAlerteTrouvesVente"].forEach(key => {
                  const biens = JSON.parse(localStorage.getItem(key) || "[]");
                  const filtres = biens.filter(b => b.id !== annonce.id);
                  localStorage.setItem(key, JSON.stringify(filtres));
                });
              } catch (err) {
                if (isNetworkError(err)) showToast("offline");
                else showToast("loadFail");
              }
              overlay.remove();
            };
          });

          container.appendChild(card);
        });
      }

      profilchargement.style.display = "none";
    } catch (err) {
      profilchargement.style.display = "none";
      if (isNetworkError(err)) showToast("offline");
      else showToast("loadFail");
    }
  });
});

/* BUG-6 FIX: Modal de modification d'annonce depuis profil */
function ouvrirModalModifierAnnonce(annonce) {
  // Supprimer un modal existant
  const existant = document.getElementById("modalModifierAnnonce");
  if (existant) existant.remove();

  const modal = document.createElement("div");
  modal.id = "modalModifierAnnonce";
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;z-index:9999;";

  const isVente = (annonce.titre || "").toLowerCase().includes("vente");

  modal.innerHTML = `
    <div style="background:#fff;border-radius:24px 24px 0 0;padding:24px 20px 40px;width:100%;max-width:420px;max-height:85dvh;overflow-y:auto;animation:slideUpModal 0.35s ease;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="font-size:18px;font-weight:700;color:#233d4c;margin:0;">✏️ Modifier l'annonce</h3>
        <button id="fermerModalModif" style="background:#f0f0f0;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;">✕</button>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">Prix (XAF)</label>
        <input type="number" id="modifPrix" value="${annonce.prix || ""}" style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">Quartier</label>
        <input type="text" id="modifQuartier" value="${annonce.quartier || ""}" style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">Repère / Point de référence</label>
        <input type="text" id="modifRepere" value="${annonce.repere || ""}" style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">Contact</label>
        <input type="tel" id="modifContact" value="${annonce.contact || ""}" style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">Description</label>
        <textarea id="modifDescription" rows="4" style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;resize:none;">${annonce.description || ""}</textarea>
      </div>

      ${!isVente ? `
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">Frais de visite (XAF, 0 si gratuit)</label>
        <input type="number" id="modifFraisVisite" value="${annonce.fraisVisite || 0}" min="0" style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">🤝 Commission / Frais d'agence <span style="font-size:11px;color:#aaa;font-weight:400;">(facultatif)</span></label>
        <input type="text" id="modifCommission" value="${annonce.commission || ""}" placeholder="Ex : 1 mois, Négociable, Aucun frais..." style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;">
      </div>
      ` : ""}

      ${!isVente ? `
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">💰 Caution (mois)</label>
        <input type="number" id="modifCaution" value="${annonce.caution || ""}" min="0" max="12" style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">📅 Avance max acceptée (mois)</label>
        <input type="number" id="modifAvanceMax" value="${annonce.avanceMax || ""}" min="0" max="24" style="width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e8e8e8;font-size:14px;">
      </div>
      ` : ""}

      <div id="loaderModif" style="display:none;text-align:center;padding:10px;">
        <div class="spinner" style="margin:auto;"></div>
        <p style="font-size:14px;color:#333;margin-top:8px;">Mise à jour...</p>
      </div>

      <button id="btnSauvegarderModif" style="width:100%;padding:14px;background:linear-gradient(135deg,#fd802e,#ff5722);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;">
        Enregistrer les modifications
      </button>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById("fermerModalModif").onclick = () => modal.remove();
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

  document.getElementById("btnSauvegarderModif").onclick = async () => {
    if (!verifierConnexion("la modification d'une annonce")) return;
    const nouveauPrix = document.getElementById("modifPrix").value;
    const nouveauQuartier = document.getElementById("modifQuartier").value.trim();
    const nouveauRepere = document.getElementById("modifRepere").value.trim();
    const nouveauContact = document.getElementById("modifContact").value.trim();
    const nouvelleDescription = document.getElementById("modifDescription").value.trim();
    const nouveauxFraisVisite = document.getElementById("modifFraisVisite")?.value || annonce.fraisVisite || "";
    const commission = document.getElementById("modifCommission")?.value?.trim() || "";
    const caution = document.getElementById("modifCaution")?.value || annonce.caution || "";
    const avanceMax = document.getElementById("modifAvanceMax")?.value || annonce.avanceMax || "";

    if (!nouveauPrix || nouveauPrix <= 0) { showToast("info", "Entrez un prix valide."); return; }
    if (!nouveauQuartier) { showToast("info", "Entrez le quartier."); return; }
    if (!nouveauContact) { showToast("info", "Entrez un contact."); return; }
    if (!nouvelleDescription) { showToast("info", "Entrez une description."); return; }

    const loaderModif = document.getElementById("loaderModif");
    loaderModif.style.display = "block";

    try {
      const res = await fetch(`${API_URL}/api/annonces/${annonce.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: currentUserUid,
          prix: nouveauPrix,
          quartier: nouveauQuartier,
          repere: nouveauRepere,
          contact: nouveauContact,
          description: nouvelleDescription,
          fraisVisite: nouveauxFraisVisite,
          caution,
          avanceMax,
          commission,
        })
      });

      const data = await res.json();
      loaderModif.style.display = "none";

      if (!res.ok) throw new Error(data.message || "Erreur lors de la modification");

      showToast("info", "✅ Annonce mise à jour !");
      modal.remove();

      // Rafraîchir la page profil
      document.getElementById("profileBtn")?.click();

    } catch (err) {
      loaderModif.style.display = "none";
      showToast("info", `❌ ${err.message}`);
    }
  };
}

const menuBtn = document.getElementById("menuBtn");
const menuContainer = document.querySelector(".dropdown-menu");
menuBtn?.addEventListener("click", () => menuContainer.classList.toggle("show"));
window.addEventListener("click", (e) => { if (!menuContainer?.contains(e.target)) menuContainer?.classList.remove("show"); });

document.getElementById("inviteFriendBtn")?.addEventListener("click", () => {
  const shareData = { title: "Chezmoi 🌟", text: "Rejoins-moi sur ChezMoi !", url: "https://chezmoi-app.netlify.app" };
  if (navigator.share) navigator.share(shareData).catch(() => {});
  else navigator.clipboard.writeText(shareData.url).then(() => showToast("clipboardSuccess")).catch(() => showToast("clipboardFail"));
  menuContainer?.classList.remove("show");
});

document.getElementById("feedbackBtn")?.addEventListener("click", () => { afficherPage("proposerIdee"); menuContainer?.classList.remove("show"); });

const logoutBtn = document.getElementById("logoutBtn");
const overlay = document.getElementById("loginOverlay");

logoutBtn?.addEventListener("click", async () => {
  let nomCompte = "Utilisateur";
  let emailCompte = "";
  try {
    const res = await fetch(`${API_URL}/api/user/${currentUserUid}`);
    if (res.ok) {
      const user = await res.json();
      nomCompte = user.nom || "Utilisateur";
      emailCompte = user.email || "";
    }
  } catch {}

  const savedAccounts = document.getElementById("savedAccounts");
  if (savedAccounts) {
    savedAccounts.innerHTML = `
      <div class="account-item" style="background:#fff8f2;border:1px solid rgba(253,128,46,0.3);">
        <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#fd802e,#ff5722);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0;">
          ${nomCompte.charAt(0).toUpperCase()}
        </div>
        <div style="text-align:left;">
          <div style="font-weight:700;color:#233d4c;font-size:14px;">${nomCompte}</div>
          <div style="font-size:12px;color:#888;">${emailCompte}</div>
          <div style="font-size:11px;color:#fd802e;font-weight:600;margin-top:2px;">Déconnecté</div>
        </div>
      </div>`;

    savedAccounts.querySelector(".account-item")?.addEventListener("click", () => {
      overlay.style.display = "none";
      afficherPage("connexion");
      if (emailCompte) {
        const conEmail = document.getElementById("con-email");
        if (conEmail) conEmail.value = emailCompte;
      }
    });
  }

  currentUserUid = null;
  localStorage.removeItem("uid");
  showToast("info", "Déconnecté !");
  overlay.style.display = "flex";
});

document.getElementById("createAccountBtn")?.addEventListener("click", () => { overlay.style.display = "none"; afficherPage("inscription"); });

document.getElementById("editProfileBtn")?.addEventListener("click", async () => {
  try {
    const res = await fetch(`${API_URL}/api/user/${currentUserUid}`);
    if (!res.ok) throw new Error();
    const user = await res.json();
    document.getElementById("editName").value = user.nom || "";
    document.getElementById("editEmail").value = user.email || "";
    document.getElementById("editContact").value = user.inscontact || "";
    const currentRole = user.role || "";
    if (currentRole) {
      const radioEdit = document.querySelector(`input[name="editRole"][value="${currentRole}"]`);
      if (radioEdit) radioEdit.checked = true;
    }
    document.getElementById("editProfileForm").classList.add("active");
  } catch { showToast("serverDown"); }
});

document.getElementById("closeProfileModal")?.addEventListener("click", () => document.getElementById("editProfileForm").classList.remove("active"));

document.getElementById("editProfileForm")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("editProfileForm")) document.getElementById("editProfileForm").classList.remove("active");
});

document.getElementById("saveProfileBtn")?.addEventListener("click", async () => {
  const nom = document.getElementById("editName").value.trim();
  const email = document.getElementById("editEmail").value.trim();
  const inscontact = document.getElementById("editContact").value.trim();
  const role = document.querySelector('input[name="editRole"]:checked')?.value || "";
  const editchargement = document.getElementById("loader-edit");
  editchargement.style.display = "flex";

  if (!currentUserUid) { showToast("info", "Vous devez être connecté."); afficherPage("inscription"); return; }

  try {
    const res = await fetch(`${API_URL}/api/user/${currentUserUid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, email, inscontact, role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    editchargement.style.display = "none";
    showToast("info", "Profil mis à jour !");
    document.getElementById("userName").textContent = nom;
    document.getElementById("userEmail").textContent = email;
    document.getElementById("userContact").textContent = inscontact;
    if (role) {
      const rolesLabels = { locataire: "🏠 Locataire", agent: "💼 Agent", proprietaire: "🔑 Propriétaire" };
      const roleEl = document.getElementById("userRole");
      if (roleEl) roleEl.textContent = rolesLabels[role] || role;
    }
    document.getElementById("editProfileForm").classList.remove("active");
  } catch (err) {
    editchargement.style.display = "none";
    if (isNetworkError(err)) showToast("offline");
    else showToast("loadFail");
  }
});

/* ===================================================== */
/* ============ PAGE FAVORIS ========================== */
/* ===================================================== */
document.getElementById("voirFavorisBtn")?.addEventListener("click", async () => {
  if (!currentUserUid) { showToast("info", "Vous devez être connecté."); afficherPage("inscription"); return; }
  afficherPage("favoris");

  const chargementfav = document.getElementById("loader-fav");
  chargementfav.style.display = "flex";
  const container = document.getElementById("favorisContainer");
  const message = document.getElementById("aucunFavorisMessage");
  container.innerHTML = "";

  try {
    const res = await fetch(`${API_URL}/api/annonces`);
    if (!res.ok) throw new Error();
    const toutes = await res.json();
    const annoncesFavorites = toutes.filter(a => favorisLocal.includes(a.id));

    chargementfav.style.display = "none";

    if (annoncesFavorites.length === 0) {
      message.style.display = "block";
      return;
    }
    message.style.display = "none";

    annoncesFavorites.forEach(annonce => {
      const joursRestants = getJoursRestants(annonce.expireAt);
      const isVente = (annonce.titre || "").toLowerCase().includes("vente");
      const imgSrc = annonce.images?.[0] || "image/logo_ChezMoi.png";

      const card = document.createElement("div");
      card.className = "fav-card";
      card.innerHTML = `
        <div class="fav-card-img-wrap">
          <img src="${imgSrc}" alt="${annonce.titre}">
          ${annonce.statut === "loue"
          ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);border-radius:18px 18px 0 0;display:flex;align-items:center;justify-content:center;z-index:8;">
              <span style="background:#e53935;color:#fff;font-size:12px;font-weight:800;padding:5px 12px;border-radius:20px;">🔒 LOUÉ</span>
            </div>`
          : joursRestants !== null && joursRestants <= 7
            ? `<div class="fav-expire ${joursRestants <= 2 ? "urgent" : ""}">
                ${joursRestants <= 2 ? `⚠ ${joursRestants}j` : `⏳ ${joursRestants}j`}
              </div>` : ""}
          <button class="fav-heart-btn" data-id="${annonce.id}">❤️</button>
        </div>
        <div class="fav-card-info">
          <div class="fav-card-top">
            <span class="fav-badge ${isVente ? "vente" : "location"}">${annonce.titre || "Location"}</span>
            <span class="fav-type">${annonce.type_annonce || ""}</span>
          </div>
          <div class="fav-loc">📍 ${annonce.ville || ""}${annonce.quartier ? " · " + annonce.quartier : ""}</div>
          <div class="fav-card-bottom">
            <span class="fav-prix">${annonce.prix ? Number(annonce.prix).toLocaleString("fr-FR") : ""} <small>XAF</small></span>
            <button class="fav-voir-btn">Voir →</button>
          </div>
        </div>`;

      card.querySelector(".fav-voir-btn").addEventListener("click", () => {
        localStorage.setItem("annonceDetail", JSON.stringify(annonce));
        afficherPage("detail");
        afficherDetailAnnonce();
      });

      const heartBtn = card.querySelector(".fav-heart-btn");
      let isFav = true;
      heartBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        isFav = await toggleFavorite(currentUserUid, annonce.id, isFav);
        if (!isFav) {
          favorisLocal = favorisLocal.filter(id => id !== annonce.id);
          card.style.animation = "fadeOutCard 0.3s ease forwards";
          setTimeout(() => {
            card.remove();
            if (container.querySelectorAll(".fav-card").length === 0) {
              message.style.display = "block";
            }
          }, 300);
        }
        heartBtn.textContent = isFav ? "❤️" : "🤍";
        const favorisCount = document.getElementById("favorisCount");
        if (favorisCount) favorisCount.textContent = favorisLocal.length;
      });

      container.appendChild(card);
    });

  } catch {
    chargementfav.style.display = "none";
    message.textContent = "Erreur lors du chargement des favoris.";
    message.style.display = "block";
  }
});

/* ===================================================== */
/* ============ HASHCHANGE & POPSTATE ================= */
/* ===================================================== */
window.addEventListener("hashchange", async () => {
  const hash = window.location.hash;

  // Ignorer les transitions liées au fullscreen
  if (hash === "#fullscreen" || !hash || hash === "#") return;

  if (hash.startsWith("#annonce-")) {
    const annonceId = hash.replace("#annonce-", "");
    try {
      const res = await fetch(`${API_URL}/api/annonces/${annonceId}`);
      if (!res.ok) throw new Error();
      const annonce = await res.json();
      localStorage.setItem("annonceDetail", JSON.stringify(annonce));
      afficherPage("detail");
      afficherDetailAnnonce();
    } catch { showToast("info", "Impossible de charger l'annonce depuis ce lien."); }
  }
  // Pas de else → le popstate gère la navigation normale
});

window.addEventListener('popstate', (event) => {
  // 1. Fullscreen image détail — priorité absolue
  const fullscreenOverlay = document.getElementById("imageFullscreenOverlay");
  if (fullscreenOverlay && fullscreenOverlay.style.display === "flex") {
    fermerImageFullscreen(true); // true = c'est le popstate qui appelle, pas de history.back()
    return; // stoppe tout — pas de navigation de page
  }

  // 2. Fullscreen wizard (plein écran upload image)
  if (overlayPleinEcran && overlayPleinEcran.style.display === "flex") {
    fermerPleinEcran(true);
    return;
  }

  // 3. Navigation normale entre pages
  const pageId = event.state?.page || 'home';
  afficherPage.skipHistory = true;
  afficherPage(pageId === 'accueil' ? 'home' : pageId);
  afficherPage.skipHistory = false;
});

/* ===================================================== */
/* ============ DROPDOWN VILLES (init au DOMContentLoaded) */
/* ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const dropbtn2 = document.querySelector(".dropbtn");
  const cityDropdown2 = document.getElementById("cityDropdown");
  if (!dropbtn2 || !cityDropdown2) return;

  dropbtn2.addEventListener("click", (e) => { e.stopPropagation(); cityDropdown2.style.display = cityDropdown2.style.display === "block" ? "none" : "block"; });
  window.addEventListener("click", () => cityDropdown2.style.display = "none");
  cityDropdown2.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      villeSelectionnee = a.textContent;
      dropbtn2.textContent = villeSelectionnee + " ▼";
      cityDropdown2.style.display = "none";
      afficherAnnoncesParGroupes(villeSelectionnee);
    });
  });
});

/* ===================================================== */
/* ============ CONTACT STATUS — FONCTIONS GLOBALES ==== */
/* ===================================================== */

async function getContactStatus(annonceId, userId) {
  try {
    const res = await fetch(
      `${API_URL}/api/contact-requests/status?annonceId=${annonceId}&userId=${userId || ''}`
    );
    if (!res.ok) throw new Error("Erreur status");
    const data = await res.json();
    const MAX = 5;
    const used = data.used || 0;
    return {
      usedToday: used,
      remaining: MAX - used,
      alreadySent: data.dejaUtilise || false,
      MAX
    };
  } catch (err) {
    console.warn("getContactStatus error:", err);
    return { usedToday: 0, remaining: 5, alreadySent: false, MAX: 5 };
  }
}

function updateContactUI(status, annonce) {
  const btnDeb         = document.getElementById("btnDebloquerContact");
  const stateMsg       = document.getElementById("contactStateMsg");
  const counterUsed    = document.getElementById("counterUsed");
  const counterLeft    = document.getElementById("counterLeft");
  const counterBarFill = document.getElementById("counterBarFill");
  const placesText     = document.getElementById("placesRestantesText");

  const { usedToday, remaining, alreadySent, MAX } = status;

  // --- Compteur visuel ---
  if (counterUsed)
    counterUsed.textContent = `🔥 ${usedToday}/${MAX} accès déjà utilisés aujourd'hui`;
  if (counterLeft)
    counterLeft.textContent = `Places restantes : ${remaining}`;
  if (counterBarFill) {
    counterBarFill.style.width = `${(usedToday / MAX) * 100}%`;
    counterBarFill.style.background = usedToday >= 4
      ? "linear-gradient(90deg,#e53935,#c62828)"
      : "linear-gradient(90deg,#fd802e,#ff5722)";
  }
  if (placesText) {
    placesText.textContent = remaining > 0
      ? `${remaining} place${remaining > 1 ? 's' : ''} aujourd'hui`
      : "Plus de places disponibles";
  }

  // --- État bouton ---
  if (!btnDeb) return;

  if (alreadySent) {
    btnDeb.disabled = true;
    btnDeb.style.opacity = "0.6";
    btnDeb.textContent = "✅ Demande déjà envoyée";
    btnDeb.style.background = "linear-gradient(135deg,#2e7d32,#388e3c)";
    btnDeb.style.animation = "none";
    if (stateMsg) {
      stateMsg.style.display = "flex";
      stateMsg.className = "contact-state-msg already-used";
      stateMsg.innerHTML = `<span>✅</span>&nbsp;Votre demande a bien été envoyée. Le propriétaire vous contactera.`;
    }
    return;
  }

  if (remaining <= 0) {
    btnDeb.disabled = true;
    btnDeb.style.opacity = "0.55";
    btnDeb.textContent = "🚫 Quota atteint pour aujourd'hui";
    btnDeb.style.background = "linear-gradient(135deg,#757575,#616161)";
    btnDeb.style.animation = "none";
    if (stateMsg) {
      stateMsg.style.display = "flex";
      stateMsg.className = "contact-state-msg quota-reached";
      stateMsg.innerHTML = `<span>🚫</span>&nbsp;Plus de contacts disponibles pour cette annonce aujourd'hui. Revenez demain.`;
    }
    return;
  }

  // --- État normal ---
  btnDeb.disabled = false;
  btnDeb.style.opacity = "1";
  btnDeb.style.background = "";
  btnDeb.textContent = "🔓 DÉBLOQUER LE CONTACT";
  btnDeb.style.animation = remaining <= 2
    ? "urgentPulse 1.2s ease-in-out infinite"
    : "";
  if (stateMsg) stateMsg.style.display = "none";
}

/* ===================================================== */
/* ============ SYSTÈME CONTACT PREMIUM ================ */
/* ===================================================== */

// ===== BULLE ROTATIVE =====
let _bulleInterval = null;

function demarrerBulleRotative() {
  const bubble = document.getElementById("agentHintBubble");
  const text = document.getElementById("agentHintText");
  if (!bubble || !text) return;

  clearInterval(_bulleInterval);

  const messages = [
    "👀 Touchez ce profil pour voir toutes les annonces de cet agent.",
    "📞 Seulement 5 accès contact disponibles aujourd'hui."
  ];
  let idx = 0;

  // Afficher immédiatement
  bubble.style.opacity = "1";
  bubble.style.transform = "translateY(0)";

  _bulleInterval = setInterval(() => {
    // Fade out
    bubble.style.opacity = "0";
    bubble.style.transform = "translateY(-6px)";
    setTimeout(() => {
      idx = (idx + 1) % messages.length;
      text.textContent = messages[idx];
      // Fade in
      bubble.style.opacity = "1";
      bubble.style.transform = "translateY(0)";
    }, 400);
  }, 4000);
}

// ===== MODAL DÉBLOQUER =====
async function ouvrirModalDebloquer(annonce) {
  const overlay = document.getElementById("modalDebloquerOverlay");
  if (!overlay) return;

  // Bloquer scroll page
  document.body.classList.add("modal-open");

  // Reset panels au step 1
  const panel1 = document.getElementById("mdmPanel1");
  const panel2 = document.getElementById("mdmPanel2");
  const step1Dot = document.getElementById("mdmStep1Dot");
  const step2Dot = document.getElementById("mdmStep2Dot");
  const stepLine = document.getElementById("mdmStepLine");

  if (panel1) panel1.style.display = "block";
  if (panel2) panel2.style.display = "none";
  if (step1Dot) { step1Dot.classList.add("active"); step1Dot.classList.remove("done"); }
  if (step2Dot) { step2Dot.classList.remove("active", "done"); }
  if (stepLine) stepLine.classList.remove("done");

  // Cacher barre qualité
  const qualityBar = document.getElementById("mdmQualityBar");
  if (qualityBar) qualityBar.style.display = "none";

  // Auto-remplir infos user
  try {
    const res = await fetch(`${API_URL}/api/user/${currentUserUid}`);
    const user = await res.json();
    const prenomEl = document.getElementById("debloquerPrenom");
    const waEl = document.getElementById("debloquerWhatsapp");
    if (prenomEl) prenomEl.value = user.nom?.split(" ")[0] || "";
    if (waEl) waEl.value = user.inscontact || "";
  } catch {}

  // Reset radios + message
  document.querySelectorAll('input[name="urgence"]').forEach(r => r.checked = false);
  document.querySelectorAll('input[name="budget"]').forEach(r => r.checked = false);
  document.querySelectorAll('input[name="visite"]').forEach(r => r.checked = false);
  const msg = document.getElementById("debloquerMessage");
  if (msg) msg.value = "";

  // Reset commission
  document.querySelectorAll('input[name="commissionChoice"]').forEach(r => r.checked = false);

  // Afficher/masquer bloc commission
  const commissionBlock = document.getElementById("mdmCommissionBlock");
  const commissionText  = document.getElementById("mdmCommissionText");
  if (commissionBlock && commissionText) {
      if (annonce.commission && annonce.commission.trim()) {
          commissionText.textContent = annonce.commission.trim();
          commissionBlock.style.display = "block";
      } else {
          commissionBlock.style.display = "none";
      }
  }

  // Reset score live
  updateScoreLive();

  // Afficher
  overlay.style.display = "flex";
  setTimeout(() => overlay.classList.add("show"), 10);

  // Listeners score live (step 2)
  const scoreInputs = ['input[name="urgence"]', 'input[name="budget"]', 'input[name="visite"]'];
  scoreInputs.forEach(sel => {
    document.querySelectorAll(sel).forEach(r => {
      r.addEventListener("change", updateScoreLive);
    });
  });
  document.getElementById("debloquerMessage")?.addEventListener("input", updateScoreLive);

  // Bouton NEXT (step 1 → step 2)
  const btnNext = document.getElementById("mdmBtnNext");
  if (btnNext) {
    // Éviter doublons de listeners
    const newBtnNext = btnNext.cloneNode(true);
    btnNext.parentNode.replaceChild(newBtnNext, btnNext);

    newBtnNext.addEventListener("click", () => {
      const prenom = document.getElementById("debloquerPrenom")?.value.trim();
      const whatsapp = document.getElementById("debloquerWhatsapp")?.value.trim();
      if (!prenom || !whatsapp) {
        showToast("info", "⚠️ Renseignez votre prénom et WhatsApp.");
        return;
      }
      if (panel1) panel1.style.display = "none";
      if (panel2) panel2.style.display = "block";
      if (step1Dot) { step1Dot.classList.remove("active"); step1Dot.classList.add("done"); }
      if (step2Dot) step2Dot.classList.add("active");
      if (stepLine) stepLine.classList.add("done");
      updateScoreLive();
    });
  }

  // Bouton submit (step 2)
  const btnContinuer = document.getElementById("btnContinuerDebloquer");
  if (btnContinuer) {
    const newBtn = btnContinuer.cloneNode(true);
    btnContinuer.parentNode.replaceChild(newBtn, btnContinuer);
    newBtn.addEventListener("click", () => soumettreDeblocage(annonce));
  }

  // Fermeture
  const btnClose = document.getElementById("modalDebloquerClose");
  if (btnClose) {
    const newClose = btnClose.cloneNode(true);
    btnClose.parentNode.replaceChild(newClose, btnClose);
    newClose.addEventListener("click", fermerModalDebloquer);
  }

  overlay.onclick = (e) => {
    if (e.target === overlay) fermerModalDebloquer();
  };
}

function fermerModalDebloquer() {
  const overlay = document.getElementById("modalDebloquerOverlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  document.body.classList.remove("modal-open");
  setTimeout(() => { overlay.style.display = "none"; }, 350);
}

/* ===================================================== */
/* ============ LEAD SCORING ========================== */
/* ===================================================== */

function calculerLeadScore(urgence, budget, visite, message) {
  let score = 0;

  // URGENCE (0–35 pts)
  const urgenceScore = {
    "IMMEDIAT":      35,
    "urgent_24h":    35, // compatibilité anciennes valeurs
    "1_2_JOURS":     30,
    "CETTE_SEMAINE": 20,
    "cette_semaine": 20,
    "PLUS_TARD":     5,
    "juste_visiter": 5
  };
  score += urgenceScore[urgence] || 0;

  // BUDGET (0–35 pts)
  const budgetScore = {
    "OK":       35,
    "oui":      35, // compat
    "NEGO":     20,
    "a_negocier": 20,
    "PAS_PRET": 0
  };
  score += budgetScore[budget] || 0;

  // VISITE (0–20 pts)
  const visiteScore = {
    "AUJOURD_HUI":  20,
    "AUJOURD'HUI":  20,
    "DEMAIN":       15,
    "CETTE_SEMAINE": 8,
    "PAS_SUR":       0
  };
  score += visiteScore[visite] || 0;

  // MESSAGE (0–10 pts)
  if (message && message.trim().length >= 20) score += 10;
  else if (message && message.trim().length > 0) score += 4;

  return Math.min(score, 100);
}

function getScoreLevel(score) {
  if (score >= 71) return { label: "🟢 Profil sérieux", color: "#2e7d32", bg: "rgba(46,125,50,0.1)" };
  if (score >= 41) return { label: "🟡 Profil moyen", color: "#e07b00", bg: "rgba(255,165,0,0.1)" };
  return { label: "🔴 Profil faible", color: "#e53935", bg: "rgba(229,57,53,0.1)" };
}

function updateScoreLive() {
  const urgence  = document.querySelector('input[name="urgence"]:checked')?.value || "";
  const budget   = document.querySelector('input[name="budget"]:checked')?.value || "";
  const visite   = document.querySelector('input[name="visite"]:checked')?.value || "";
  const message  = document.getElementById("debloquerMessage")?.value || "";

  const score    = calculerLeadScore(urgence, budget, visite, message);
  const level    = getScoreLevel(score);

  const fill     = document.getElementById("mslFill");
  const text     = document.getElementById("mslText");

  if (!fill || !text) return;

  // N'afficher que si au moins 1 choix fait
  const hasInput = urgence || budget || visite || message.trim();
  if (!hasInput) {
    fill.style.width = "0%";
    text.textContent = "Complétez les champs pour voir votre score";
    text.style.color = "#888";
    return;
  }

  fill.style.width = score + "%";
  fill.style.background = score >= 71
    ? "linear-gradient(90deg, #2e7d32, #4caf50)"
    : score >= 41
      ? "linear-gradient(90deg, #e07b00, #ffa000)"
      : "linear-gradient(90deg, #e53935, #ef5350)";

  text.textContent = `${score}/100 — ${level.label}`;
  text.style.color = level.color;

  // Conseil si score faible
  if (score < 40) {
    text.textContent += " — Améliorez votre profil pour augmenter vos chances";
  }
}

function msgProfilFaible({ prenom, titre, type_annonce, ville, whatsapp }) {
  const numPropre = String(whatsapp || "").replace(/\D/g, "");
  return `👋 Salut ${prenom},

  Merci pour ta demande sur ChezMoi 🙌

  On a bien reçu ta recherche pour :
  🏠 ${type_annonce} — ${ville}

  ⚠️ Important
  Ton profil indique que tu es encore en phase de recherche exploratoire.

  ❌ Résultat : Ta demande n'a pas été envoyée au propriétaire.

  👉 Pour avoir une chance d'être contacté, tu dois refaire une nouvelle demande avec un profil plus précis.

  💡 Conseil ChezMoi :
  - précise ton budget réel
  - indique si tu es prêt à emménager rapidement
  - ajoute une date de visite claire

  🚀 Les profils sérieux sont prioritaires.
  ━━━━━━━━━━━━━━━
  🏠 Voir plus d'annonces → https://chezmoi-app.netlify
  ✏️ Refaire une demande → Rouvrir l'annonce sur ChezMoi`;
}

async function soumettreDeblocage(annonce) {
  if (!verifierConnexion("l'envoi d'une demande de contact")) return;
  const prenom   = document.getElementById("debloquerPrenom")?.value.trim();
  const whatsapp = document.getElementById("debloquerWhatsapp")?.value.trim();
  const urgence  = document.querySelector('input[name="urgence"]:checked')?.value;
  const budget   = document.querySelector('input[name="budget"]:checked')?.value;
  const visite   = document.querySelector('input[name="visite"]:checked')?.value || "";
  const message  = document.getElementById("debloquerMessage")?.value.trim() || "";
  const commissionChoice = document.querySelector('input[name="commissionChoice"]:checked')?.value || "";
  const loader   = document.getElementById("loaderDebloquer");
  const btnCont  = document.getElementById("btnContinuerDebloquer");

  if (!prenom || !whatsapp || !urgence || !budget) {
    showToast("info", "⚠️ Choisissez vos préférences d'emménagement et de budget.");
    return;
  }

  // Validation commission si applicable
  if (annonce.commission && annonce.commission.trim() && !commissionChoice) {
    showToast("info", "⚠️ Précisez votre position sur les frais de commission.");
    return;
  }

  // ===== LEAD SCORING =====
  const score = calculerLeadScore(urgence, budget, visite, message);
  const level = getScoreLevel(score);

  // ===== PROFIL FAIBLE : bloquer et envoyer message WhatsApp =====
  if (score < 40) {
    if (loader) loader.style.display = "block";
    if (btnCont) btnCont.disabled = true;

    // Afficher feedback visuel
    showToast("info", `❌ Profil insuffisant (${score}/100). Veuillez compléter votre profil.`);

    // Envoyer message WhatsApp au demandeur uniquement
    try {
      const numDemandeur = String(whatsapp).replace(/\D/g, "");
      if (numDemandeur) {
        await fetch(`${API_URL}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: currentUserUid,
            title: "ChezMoi — Profil incomplet",
            body: `Votre profil (${score}/100) est trop faible. Complétez-le pour contacter le propriétaire.`,
            annonceId: annonce.id,
            typeAlerte: "profil_faible",
            count: 1
          })
        });
      }
    } catch {}

    // Appel backend pour envoyer le WhatsApp d'avertissement au demandeur
    // (via endpoint existant whatsapp bot)
    try {
      const msgFaible = msgProfilFaible({
        prenom,
        titre: annonce.type_annonce || "Annonce",
        ville: annonce.ville || "",
        whatsapp
      });

      await fetch(`${API_URL}/api/whatsapp-profil-faible`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: whatsapp,
          message: msgFaible
        })
      }).catch(() => {}); // silencieux si endpoint absent
    } catch {}

    if (loader) loader.style.display = "none";
    if (btnCont) btnCont.disabled = false;

    // Afficher message dans le modal
    const panel2 = document.getElementById("mdmPanel2");
    if (panel2) {
      const alertBox = document.createElement("div");
      alertBox.style.cssText = `
        background: rgba(229,57,53,0.08);
        border: 1.5px solid rgba(229,57,53,0.3);
        border-radius: 14px;
        padding: 16px;
        margin: 14px 0;
        text-align: center;
        animation: fadeIn 0.3s ease;
      `;
      alertBox.innerHTML = `
        <div style="font-size:28px;margin-bottom:8px;">❌</div>
        <div style="font-weight:700;color:#e53935;font-size:14px;margin-bottom:6px;">Profil insuffisant — Score ${score}/100</div>
        <div style="font-size:12px;color:#666;line-height:1.6;">
          Votre demande n'a pas été envoyée.<br>
          Sélectionnez un emménagement <strong>urgent</strong>, confirmez votre budget et ajoutez une disponibilité de visite précise.
        </div>`;
      // Insérer avant le score live
      const scoreLive = document.getElementById("mdmScoreLive");
      if (scoreLive) scoreLive.parentNode.insertBefore(alertBox, scoreLive);
      else panel2.prepend(alertBox);

      // Auto-supprimer après 5s
      setTimeout(() => alertBox.remove(), 6000);
    }
    return; // ← BLOQUER ICI — ne pas continuer vers le backend
  }

  // ===== SCORE ≥ 40 : SYSTÈME EXISTANT INCHANGÉ =====
  if (loader) loader.style.display = "block";
  if (btnCont) btnCont.style.display = "none";

  try {
    const res = await fetch(`${API_URL}/api/contact-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        annonceId: annonce.id,
        ownerId:   annonce.uid || "",
        userId:    currentUserUid,
        prenom,
        whatsapp,
        urgence,
        budget,
        visite,
        message,
        commissionChoice,
        commission: annonce.commission || ""
      })
    });

    const data = await res.json();

    if (loader) loader.style.display = "none";
    if (btnCont) btnCont.style.display = "block";

    if (!res.ok) {
      showToast("info", `❌ ${data.message}`);
      fermerModalDebloquer();
      const status = await getContactStatus(annonce.id, currentUserUid);
      updateContactUI(status, annonce);
      return;
    }

    fermerModalDebloquer();
    showToast("info", `✅ Demande envoyée ! (Score ${score}/100 — ${level.label})`);

    const freshStatus = await getContactStatus(annonce.id, currentUserUid);
    updateContactUI(freshStatus, annonce);

  } catch (err) {
    if (loader) loader.style.display = "none";
    if (btnCont) btnCont.style.display = "block";
    if (isNetworkError(err)) showToast("offline");
    else showToast("loadFail");
  }
}

// ===== PAGE AGENT =====
async function ouvrirPageAgent(ownerId, annonceRef) {
  const overlay = document.getElementById("pageAgentOverlay");
  if (!overlay) return;

  overlay.style.display = "flex";
  setTimeout(() => overlay.classList.add("show"), 10);

  const pageAgentNom = document.getElementById("pageAgentNom");
  const pageAgentAvatar = document.getElementById("pageAgentAvatar");
  const pageAgentCount = document.getElementById("pageAgentCount");
  const pageAgentAnnonces = document.getElementById("pageAgentAnnonces");

  // Charger profil
  try {
    const res = await fetch(`${API_URL}/api/user/${ownerId}`);
    const user = await res.json();
    if (pageAgentNom) pageAgentNom.textContent = user.nom || "Agent";
    if (pageAgentAvatar) {
      const initiale = (user.nom || "A").charAt(0).toUpperCase();
      pageAgentAvatar.textContent = initiale;
    }
  } catch {}

  // Charger annonces de l'agent
  try {
    const res = await fetch(`${API_URL}/api/annonces/user/${ownerId}`);
    const annonces = await res.json();

    if (pageAgentCount) pageAgentCount.textContent = `${annonces.length} annonce${annonces.length > 1 ? 's' : ''}`;
    if (pageAgentAnnonces) {
      pageAgentAnnonces.innerHTML = "";

      if (annonces.length === 0) {
        pageAgentAnnonces.innerHTML = `<p style="text-align:center;color:#888;padding:30px;">Aucune annonce disponible.</p>`;
        return;
      }

      annonces.forEach(a => {
        const imgSrc = a.images?.[0] || "image/logo_ChezMoi.png";
        const card = document.createElement("div");
        card.className = "agent-annonce-card";
        card.innerHTML = `
          <img src="${imgSrc}" alt="${a.titre}">
          <div class="agent-card-body">
            <span class="agent-card-badge">${a.titre || "Annonce"}</span>
            <div class="agent-card-type">${a.type_annonce || ""}</div>
            <div class="agent-card-loc">📍 ${a.ville || ""}${a.quartier ? " · " + a.quartier : ""}</div>
            <div class="agent-card-prix">${a.prix ? Number(a.prix).toLocaleString("fr-FR") : ""} XAF</div>
          </div>`;
        card.onclick = () => {
          fermerPageAgent();
          localStorage.setItem("annonceDetail", JSON.stringify(a));
          afficherDetailAnnonce();
        };
        pageAgentAnnonces.appendChild(card);
      });
    }
  } catch {
    if (pageAgentAnnonces) pageAgentAnnonces.innerHTML = `<p style="text-align:center;color:red;padding:30px;">Erreur de chargement.</p>`;
  }

  // Bouton retour
  const backBtn = document.getElementById("pageAgentBack");
  if (backBtn) backBtn.onclick = fermerPageAgent;
}

function fermerPageAgent() {
  const overlay = document.getElementById("pageAgentOverlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  setTimeout(() => { overlay.style.display = "none"; }, 300);
}

/* ===================================================== */
/* ============ PULL TO REFRESH ====================== */
/* ===================================================== */
const homeContent = document.querySelector('.home-content');
const spinnerHome = document.getElementById('pull-spinner');
let touchStartY = 0, isPulling = false, isRefreshing = false;

homeContent?.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; isPulling = false; });

homeContent?.addEventListener('touchmove', (e) => {
  const diff = e.touches[0].clientY - touchStartY;
  if (homeContent.scrollTop === 0 && diff > 0 && !isRefreshing) {
    isPulling = true;
    spinnerHome.style.transform = `translateX(-50%) translateY(${Math.min(diff - 50, 50)}px)`;
    spinnerHome.style.opacity = Math.min(diff / 100, 1);
    if (diff > 70) spinnerHome.classList.add('active');
    else spinnerHome.classList.remove('active');
  } else { isPulling = false; spinnerHome.classList.remove('active'); }
});

homeContent?.addEventListener('touchend', (e) => {
  if (!isPulling) return;
  const diff = e.changedTouches[0].clientY - touchStartY;
  if (diff > 70 && !isRefreshing) {
    isRefreshing = true;
    spinnerHome.classList.add('active');
    // Actualisation complète : annonces + favoris
    Promise.all([
      afficherAnnoncesParGroupes(villeSelectionnee),
      currentUserUid ? fetch(`${API_URL}/api/favorites/${currentUserUid}`)
        .then(r => r.json()).then(f => { favorisLocal = f; }).catch(() => {}) : Promise.resolve()
    ]).finally(() => {
      isRefreshing = false;
      spinnerHome.classList.remove('active');
      spinnerHome.style.opacity = 0;
      spinnerHome.style.transform = 'translateX(-50%) translateY(-60px)';
    });
  } else {
    spinnerHome.classList.remove('active');
    spinnerHome.style.opacity = 0;
    spinnerHome.style.transform = 'translateX(-50%) translateY(-60px)';
  }
  touchStartY = 0; isPulling = false;
});