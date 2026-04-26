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
function showToast(type = "info", customMessage = "") {
  const messages = {
    offline: "⚠️ Impossible de se connecter. Vérifiez votre connexion internet.",
    loadFail: "❌ Échec du chargement. Veuillez réessayer.",
    success: "✅ Action effectuée avec succès !",
    formIncomplete: "⚠️ Veuillez remplir tous les champs requis.",
    serverDown: "⚠️ Le serveur ne répond pas. Réessayez plus tard.",
    clipboardSuccess: "✅ Lien copié dans le presse-papiers !",
    clipboardFail: "❌ Impossible de copier le lien.",
    imageMissing: "⚠️ Veuillez sélectionner au moins une image."
  };

  let color;
  if (type === "success" || type === "clipboardSuccess") color = "#233d4c";
  else if (type === "error" || type === "loadFail" || type === "clipboardFail") color = "#c62828";
  else if (type === "info") color = "#fd802e";
  else color = "#fd802e";

  const message = messages[type] || customMessage;
  Toastify({
    text: message,
    duration: 3500,
    gravity: "bottom",
    position: "center",
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

function setupConnectionWatcher() {
  if (!navigator.onLine) showToast("info", "⚠️ Vous êtes hors ligne.");
  window.addEventListener('offline', () => showToast("info", "⚠️ Vous êtes hors ligne."));
  window.addEventListener('online', () => showToast("success", "✅ Connexion rétablie !"));
}
setupConnectionWatcher();

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
      showToast("loadFail");
      afficherPage(savedUid ? "home" : "accueil");
    }
  } else {
    afficherPage(savedUid ? "home" : "accueil");
    if (savedUid) afficherAnnoncesParGroupes(villeSelectionnee);
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

window.addEventListener("offline", () => {
  safeToast("offline");
});

window.addEventListener("online", () => {
  safeToast("success", "🌐 Connexion rétablie !");
});

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
  btn.addEventListener("click", async () => {
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

      const titre = document.createElement("h3");
      titre.className = "categorie-title";
      titre.textContent = group.join(" & ");
      section.appendChild(titre);

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
              ${joursRestants !== null && joursRestants <= 7
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
    showToast("loadFail");
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
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
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
  if (validerEtape(currentStep)) goToStep(currentStep + 1);
});
document.getElementById("btnPrecedent")?.addEventListener("click", () => goToStep(currentStep - 1));

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
      showToast("loadFail");
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
      afficherAnnoncesParGroupes(villeSelectionnee);

    } catch (err) {
      if (loaderCon) loaderCon.style.display = "none";
      showToast("loadFail");
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

  if (_googleIdToken) {
    try {
      const res = await fetch(`${API_URL}/api/google-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: _googleIdToken, inscontact })
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
      showToast("loadFail");
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
      body: JSON.stringify({ nom, email, password, inscontact })
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
    afficherAnnoncesParGroupes(villeSelectionnee);

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
    showToast("loadFail");
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

  selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const card = document.createElement("div");
      card.classList.add("image-card");
      const img = document.createElement("img");
      img.src = e.target.result;
      card.appendChild(img);
      img.addEventListener("click", (ev) => { ev.stopPropagation(); afficherPleinEcran(e.target.result); });
      const btnSuppr = document.createElement("div");
      btnSuppr.classList.add("btnSuppr");
      btnSuppr.textContent = "✖";
      btnSuppr.addEventListener("click", (ev) => { ev.stopPropagation(); selectedFiles.splice(index, 1); renderGrid(); updateImageCounter(); });
      card.appendChild(btnSuppr);
      imageGrid.appendChild(card);
    };
    reader.readAsDataURL(file);
  });

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
      if (width > 1200) { height *= 1200 / width; width = 1200; }
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
  if (!currentUserUid) { showToast("info", "Vous devez être connecté."); afficherPage("inscription"); return; }

  const titre = document.querySelector('input[name="titre"]:checked')?.value;
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
    formData.append("titre_propriete", document.querySelector('input[name="titre_propriete"]:checked')?.value || "");
    formData.append("negociable", document.querySelector('input[name="negociable"]:checked')?.value || "");
    formData.append("delai_vente", document.querySelector('input[name="delai_vente"]:checked')?.value || "");
    formData.append("statut", "published");
    formData.append("statut_numero", "verrouille");

    for (let file of selectedFiles) {
      const compressedFile = await compressImage(file);
      formData.append("images", compressedFile);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 secondes max

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
    showToast("info", "✅ Annonce publiée avec succès ! Elle sera visible 30 jours.");
    resetFormulaire();
    afficherPage("home");
    afficherAnnoncesParGroupes(villeSelectionnee);

  } catch (error) {
    showToast("loadFail");
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
      el.innerHTML = `<span class="equip-icon">${eq.icon}</span><span>${eq.label}</span><span>${eq.val === "oui" ? "✅" : "❌"}</span>`;
      equipGrid.appendChild(el);
    });

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

  const contactEl = document.getElementById("detailContact");
  if (contactEl) contactEl.textContent = annonce.contact || "Non renseigné";

  const btnAppeler = document.getElementById("btnAppeler");
  const btnWhatsapp = document.getElementById("btnWhatsapp");
  if (btnAppeler && annonce.contact) {
    btnAppeler.onclick = () => window.open(`tel:${annonce.contact}`);
  }
  if (btnWhatsapp && annonce.contact) {
    const num = annonce.contact.replace(/\s/g, "");
    const waNum = num.startsWith("+") ? num.replace("+", "") : `242${num}`;
    const msg = encodeURIComponent(`Bonjour, je vous contacte au sujet de votre annonce "${annonce.titre}" sur ChezMoi (${annonce.ville}).`);
    btnWhatsapp.onclick = () => window.open(`https://wa.me/${waNum}?text=${msg}`, "_blank");
  }

  const shareBtn = document.getElementById("detailShareBtn");
  if (shareBtn) shareBtn.onclick = () => partagerAnnonce(annonce);

  const btnDebloquer = document.getElementById("btnDebloquerContact");
  if (btnDebloquer) btnDebloquer.style.display = "none";

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
    Object.assign(overlay.style, { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "pointer" });
    const fullscreenImg = document.createElement("img");
    fullscreenImg.id = "fullscreenImg";
    fullscreenImg.style.maxWidth = "90%";
    fullscreenImg.style.maxHeight = "90%";
    overlay.appendChild(fullscreenImg);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", () => overlay.style.display = "none");
    document.addEventListener("keydown", e => { if (e.key === "Escape") overlay.style.display = "none"; });
  }
  document.getElementById("fullscreenImg").src = src;
  overlay.style.display = "flex";
  history.pushState({ fullscreen: true }, '', '#fullscreen');
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
    showToast("loadFail");
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
      const imgSrc = annonce.images?.[0] || "image/logo_ChezMoi.png";
      card.innerHTML = `
        <img src="${imgSrc}" alt="${annonce.titre}">
        ${joursRestants !== null && joursRestants <= 7
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

function chargerPageAlertes() {
  alerteLocale = JSON.parse(localStorage.getItem("alerteChezMoi") || "null");
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

  const key = typeAlerte === "vente" ? "alerteChezMoiVente" : "alerteChezMoi";
  localStorage.setItem(key, JSON.stringify(nouvelleAlerte));
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
async function demanderNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;
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

    try {
      const resUser = await fetch(`${API_URL}/api/user/${currentUserUid}`);
      if (!resUser.ok) throw new Error();
      const user = await resUser.json();

      document.getElementById("userName").textContent = user.nom || "Utilisateur";
      document.getElementById("userEmail").textContent = user.email || "-";
      document.getElementById("userContact").textContent = user.inscontact || "Non renseigné";

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
              } catch { showToast("loadFail"); }
              overlay.remove();
            };
          });

          container.appendChild(card);
        });
      }

      profilchargement.style.display = "none";
    } catch {
      profilchargement.style.display = "none";
      showToast("loadFail");
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
    const nouveauPrix = document.getElementById("modifPrix").value;
    const nouveauQuartier = document.getElementById("modifQuartier").value.trim();
    const nouveauRepere = document.getElementById("modifRepere").value.trim();
    const nouveauContact = document.getElementById("modifContact").value.trim();
    const nouvelleDescription = document.getElementById("modifDescription").value.trim();
    const nouveauxFraisVisite = document.getElementById("modifFraisVisite")?.value || annonce.fraisVisite || "";

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
          fraisVisite: nouveauxFraisVisite
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
  const editchargement = document.getElementById("loader-edit");
  editchargement.style.display = "flex";

  if (!currentUserUid) { showToast("info", "Vous devez être connecté."); afficherPage("inscription"); return; }

  try {
    const res = await fetch(`${API_URL}/api/user/${currentUserUid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, email, inscontact })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    editchargement.style.display = "none";
    showToast("info", "Profil mis à jour !");
    document.getElementById("userName").textContent = nom;
    document.getElementById("userEmail").textContent = email;
    document.getElementById("userContact").textContent = inscontact;
    document.getElementById("editProfileForm").classList.remove("active");
  } catch {
    editchargement.style.display = "none";
    showToast("loadFail");
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
          ${joursRestants !== null && joursRestants <= 7
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
  } else {
    afficherPage("home");
  }
});

window.addEventListener('popstate', (event) => {
  // Overlay plein écran wizard
  if (overlayPleinEcran && overlayPleinEcran.style.display === "flex") {
    fermerPleinEcran(true);
    return;
  }
  // Overlay fullscreen détail
  const fullscreenOverlay = document.getElementById("imageFullscreenOverlay");
  if (fullscreenOverlay && fullscreenOverlay.style.display === "flex") {
    fullscreenOverlay.style.display = "none";
    return; // IMPORTANT : ne pas continuer
  }
  // Navigation normale
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