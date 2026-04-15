/* ===================================================== */
/* ================= VARIABLES GLOBALES ================= */
/* ===================================================== */
const API_URL = "https://chezmoi-backend.onrender.com";
let currentUserUid = null;
// Vérifier si utilisateur déjà connecté au rechargement
const savedUid = localStorage.getItem("uid");
if(savedUid){
    currentUserUid = savedUid;
}
let villeSelectionnee = "Toutes les villes";
let selectedImages = [];
let favorisLocal = []; // tableau pour stocker les IDs d'annonces favorites

function showToast(type = "info", customMessage = "") {
  // dictionnaire des messages en français
  const messages = {
    offline: "⚠️ Impossible de se connecter. Vérifiez votre connexion internet.",
    loadFail: "❌ Échec du chargement. Veuillez réessayer.",
    success: "✅ Action effectuée avec succès !",
    paymentFail: "❌ Le paiement a échoué. Veuillez réessayer.",
    formIncomplete: "⚠️ Veuillez remplir tous les champs requis.",
    serverDown: "⚠️ Le serveur ne répond pas. Réessayez plus tard.",
    clipboardSuccess: "✅ Lien copié dans le presse-papiers ! Partage-le avec tes amis !",
    clipboardFail: "❌ Impossible de copier le lien. Veuillez réessayer.",
    imageMissing: "⚠️ Veuillez sélectionner au moins une image."
  };

    // couleur selon type
    let color;
    if(type === "success" || type === "clipboardSuccess") color = "#233d4c";     // bleu foncé ChezMoi
    else if(type === "error" || type === "loadFail" || type === "clipboardFail") color = "#c62828"; // rouge
    else if(type === "info") color = "#fd802e";     // orange ChezMoi ← couleur principale
    else if(type === "warning") color = "#233d4c";  // bleu foncé
    else color = "#fd802e"; // fallback orange

  // message final : message du dictionnaire ou message personnalisé
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

// Setup global de la connexion
function setupConnectionWatcher() {
    if (!navigator.onLine) {
        showToast("info", "⚠️ Vous êtes hors ligne. Vérifiez votre connexion internet.");
    }
    window.addEventListener('offline', () => {
        showToast("info", "⚠️ Vous êtes hors ligne. Vérifiez votre connexion internet.");
    });
    window.addEventListener('online', () => {
        showToast("success", "✅ Connexion rétablie !");
    });
}
setupConnectionWatcher(); // appel dès le démarrage

// calcule les jours avant expiration
function getJoursRestants(expireAt){
    if(!expireAt) return null;

    const now = new Date();
    const expireDate = new Date(expireAt._seconds * 1000);

    const diff = expireDate - now;

    const jours = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return jours;
}

// =====================
// LOGIQUE ICONES ACTIVES (Home / Explore)
// =====================

const homeBtn = document.querySelector('[data-page="home"]');
const exploreBtn = document.querySelector('[data-page="explore"]');

function updateIconActive(pageId) {
    // Désactive tous les boutons
    const allNavButtons = document.querySelectorAll('.app-nav-item');
    allNavButtons.forEach(btn => btn.classList.remove('active'));

    // Active uniquement le bouton correspondant à la page
    const activeBtn = document.querySelector(`.app-nav-item[data-page="${pageId}"]`);
    if(activeBtn) activeBtn.classList.add('active');
}

/* ===================================================== */
/* ================= NAVIGATION ======================== */
/* ===================================================== */
const triggers = document.querySelectorAll("[data-page]");
const pages = document.querySelectorAll(".page");
const nav = document.querySelector(".app-nav");
const pagesSansNav = [
    "accueil", "inscription", "connexion", "recherche", "ajouter", "detail",
    "signalerProbleme", "proposerIdee", "paiementDeblocage", "paiementPublication"

];

function afficherPage(id) {
    // Vider le formulaire si on quitte la page "ajouter"
    const pageActive = document.querySelector(".page.active");
    if (pageActive && pageActive.id === "ajouter" && id !== "ajouter") {
        resetFormulaire();
    }

    pages.forEach(page => page.classList.remove("active"));

    const accueil = document.getElementById("accueil");
    if (accueil) accueil.style.display = (id === "accueil") ? "flex" : "none";

    const currentPage = document.getElementById(id);
    if (currentPage) currentPage.classList.add("active");
    if(nav){
        nav.style.display = pagesSansNav.includes(id) ? "none" : "flex";
    }

    if(id === "home") afficherAnnoncesParGroupes(villeSelectionnee);
    
    if (!afficherPage.skipHistory) {
        history.pushState({page: id}, '', '#' + id);
    }

    updateIconActive(id);
}

triggers.forEach(el => {
    el.addEventListener("click", () => {
        const pageId = el.getAttribute("data-page");
        afficherPage(pageId);
    });
});

window.addEventListener("DOMContentLoaded", async () => {

    // ===== Service Worker =====
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            window.location.reload();
                        }
                    });
                });
                showToast("success");
            })
            .catch(err => showToast("loadFail"));
    }

    // ===== Vérifier utilisateur =====
    const savedUid = localStorage.getItem("uid");
    if(savedUid){
        currentUserUid = savedUid;
    }

    // ===== Charger hash annonce si présent =====
    const hash = window.location.hash;
    if(hash.startsWith("#annonce-")){
        const annonceId = hash.replace("#annonce-", "");
        try {
            const res = await fetch(`${API_URL}/api/annonces/${annonceId}`);
            if(!res.ok) throw new Error("Annonce introuvable");
            const annonce = await res.json();
            localStorage.setItem("annonceDetail", JSON.stringify(annonce));
            afficherPage("detail");
            afficherDetailAnnonce();
        } catch(err){
            console.error(err);
            showToast("loadFail");
            afficherPage(savedUid ? "home" : "accueil");
        }
    } else {
        // pas de hash => page par défaut
        afficherPage(savedUid ? "home" : "accueil");
        if(savedUid) afficherAnnoncesParGroupes(villeSelectionnee);
    }
});

// === Fonction toggle favoris ===
async function toggleFavorite(uid, annonceId, isFavorite) {
  try {

    const url = "https://chezmoi-backend.onrender.com/api/favorites";

    let response;

    if (isFavorite) {
      response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, annonceId })
      });
    } else {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, annonceId })
      });
    }

    if(!response.ok){
        throw new Error("Erreur serveur favoris");
    }

    return !isFavorite;

  } catch (err) {
    // toast
    showToast("loadFail");
    return isFavorite;
  }
}

/* ========================= */
/* SETUP BOUTON FAVORIS =====*/
function setupFavoriButton(btn, annonce) {
    let isFavorite = favorisLocal.includes(annonce.id);
    btn.textContent = isFavorite ? "❤️" : "🤍";

    btn.addEventListener("click", async () => {
        if(!currentUserUid){
            showToast("offline");
            return;
        }

        // Appel serveur pour ajouter/supprimer
        isFavorite = await toggleFavorite(currentUserUid, annonce.id, isFavorite);

        // Mettre à jour favorisLocal
        if(isFavorite){
            if(!favorisLocal.includes(annonce.id)) favorisLocal.push(annonce.id);
        } else {
            favorisLocal = favorisLocal.filter(id => id !== annonce.id);
        }

        // Mettre à jour l’affichage du bouton
        btn.textContent = isFavorite ? "❤️" : "🤍";
        const favorisCount = document.getElementById("favorisCount");
        if(favorisCount){
            favorisCount.textContent = favorisLocal.length;
        }
    });
}

/* ===================================================== */
/* ================= AFFICHAGE ANNONCES ================= */
/* ===================================================== */

// ====== Fonction globale de partage ======
function partagerAnnonce(annonce) {
    const titre = annonce.titre; // ex: "Location" ou "Vente"
    const prix = annonce.prix;
    const ville = annonce.ville;
    const type = annonce.type_annonce; // ex: "Appartement", "Maison"

    // Emoji selon type de bien
    const emojiBien = type.toLowerCase().includes("appartement") ? "🏢" :
                      type.toLowerCase().includes("maison") ? "🏠" :
                      type.toLowerCase().includes("terrain") ? "🌳" : "🏡";

    // Lien vers l'annonce sur ton site Netlify
    const url = `https://chezmoi-app.netlify.app#annonce-${annonce.id}`;

    // Texte attractif
    const texte = `🚨 Nouvelle ${titre} : ${type} ${emojiBien} à ${ville} !\n` +
                  `Prix : ${prix} XAF\n` +
                  `Découvre vite cette annonce sur ChezMoi 👉`;

    if (navigator.share) {
        navigator.share({
            title: `ChezMoi 🌟: ${titre} - ${type}`,
            text: texte,
            url: url
        })
        .catch((error) => showToast("loadFail"));
    } else {
        navigator.clipboard.writeText(url)
            .then(() => showToast("clipboardSuccess")) // message spécifique presse-papiers
            .catch(() => showToast("clipboardFail"));  // message échec copie
    }
}

// ====== Affichage des annonces par groupes ======
async function afficherAnnoncesParGroupes(ville) {

    const container = document.getElementById("categoriesContainer");
    const spinner = document.getElementById("spinner"); 

    if(!container || !spinner) return;

    // Afficher le spinner et cacher le contenu
    spinner.style.display = "flex";
    container.style.display = "none";

    try {
        const response = await fetch(`${API_URL}/api/annonces`);
        if(!response.ok) throw new Error("Erreur serveur");

        const annonces = await response.json();

        const annoncesFiltrees = ville.toLowerCase() === "toutes les villes".toLowerCase()
            ? annonces
            : annonces.filter(a => a.ville.toLowerCase() === ville.toLowerCase());


        // ===== CHARGER LES FAVORIS =====
        const uid = currentUserUid;
        let favorisUtilisateur = [];

        if(uid){
            try{
                const favRes = await fetch(`${API_URL}/api/favorites/${uid}`);
                favorisUtilisateur = await favRes.json();
                favorisLocal = favorisUtilisateur;
            }catch(err){
                showToast("loadFail");
                favorisLocal = [];
            }
        }

        container.innerHTML = "";

        if(annoncesFiltrees.length === 0){
            spinner.style.display = "none";
            container.style.display = "block";
            container.innerHTML = `<p style="text-align:center; font-size:18px; margin-top:50px;">
                Aucune annonce publiée pour le moment.
            </p>`;
            return;
        }

        function getCouleur(titre) {
            if(!titre) return "#777";
            const t = titre.toLowerCase();
            if (t.includes("vente") || t.includes("vendre")) return "green";
            if (t.includes("location") || t.includes("louer")) return "blue";
            return "#777";
        }

        // ====== Catégories ======
        const groupedCategories = [
            ["studio","appartement"],
            ["villa","maison simple"],
            ["2-3-4 chambres et plus"],
            ["parcelle","terrain"]
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

            if(group[0] === "2-3-4 chambres et plus"){
                annoncesDuo = annoncesFiltrees.filter(a => {
                    const t = a.type_annonce?.toLowerCase();
                    return t === "maison 2 chambre" || t === "maison 3 chambre" || t === "maison 4 chambre et plus";
                });
            } else {
                annoncesDuo = annoncesFiltrees.filter(a =>
                    group.some(c => a.type_annonce?.toLowerCase() === c.toLowerCase())
                );
            }

            if(annoncesDuo.length === 0){
                row.innerHTML = `<p style="text-align:center; font-size:16px; margin-top:20px;">
                    Aucune annonce pour ${group.join(" & ")}.
                </p>`;
            } else {

                annoncesDuo.forEach((annonce) => {

                    const joursRestants = getJoursRestants(annonce.expireAt);
                    const card = document.createElement("div");
                    card.className = "annonce-card";

                    const imgSrc = annonce.images?.[0] || "image/logo_ChezMoi.png";
                    const couleur = getCouleur(annonce.titre);

                    card.innerHTML = `
                        <span class="annonce-type" style="background:${couleur}; color:white;">
                            ${annonce.titre}
                        </span>

                        ${joursRestants !== null && joursRestants <= 7
                            ? `<div class="expire-info ${joursRestants <= 2 ? "urgent" : ""}">
                                ${joursRestants <= 2 
                                    ? `⚠ expire dans ${joursRestants} jour(s)` 
                                    : `expire dans ${joursRestants} jour(s)`
                                }
                            </div>` 
                        : ""}

                        <img class="annonce-img" src="${imgSrc}" alt="${annonce.titre}">

                        <div class="type-annonce">
                            <span class="annonce-quartier">${annonce.quartier}</span> -
                            <span class="annonce-type-text">${annonce.type_annonce || ""}</span>
                        </div>

                        <div class="annonce-footer">

                            <div class="annonce-info">
                                <span class="ville">${annonce.ville}</span>
                                <span class="prix">${annonce.prix} XAF</span>
                            </div>

                            <button class="btn-details">Voir</button>

                            <button class="btn-share">
                                <img src="image/partager.png" alt="Partager" class="share-icon">
                            </button>

                            <button class="btn-fav" data-id="${annonce.id}">🤍</button>

                        </div>
                    `;

                    row.appendChild(card);

                    // ===== BOUTON VOIR =====
                    card.querySelector(".btn-details").addEventListener("click", () => {
                        localStorage.setItem("annonceDetail", JSON.stringify(annonce));
                        afficherPage("detail");
                        afficherDetailAnnonce();
                    });

                    // ===== BOUTON PARTAGER =====
                    card.querySelector(".btn-share").addEventListener("click", () => {
                        partagerAnnonce(annonce);
                    });

                    // ===== BOUTON FAVORI =====
                    let favBtn = card.querySelector(".btn-fav");

                    favBtn.replaceWith(favBtn.cloneNode(true));
                    favBtn = card.querySelector(".btn-fav");

                    setupFavoriButton(favBtn, annonce);

                });

            }

            section.appendChild(row);
            container.appendChild(section);

        });

        spinner.style.display = "none";
        container.style.display = "block";

    } catch(error){

        spinner.style.display = "none";
        container.style.display = "block";

        container.innerHTML = `
            <div style="text-align:center; margin-top:50px; padding:20px; background:#ffe6e6; border-radius:10px; box-shadow:0 4px 8px rgba(0,0,0,0.1);">
                <p style="font-size:18px; color:#cc0000; margin-bottom:20px;">
                    ⚠️ Erreur de chargement des annonces.<br>
                    Veuillez vérifier votre connexion internet !
                </p>
                <button id="retryBtn" style="
                    padding:10px 20px;
                    font-size:16px;
                    background:#233d4c;
                    color:#fff;
                    border:none;
                    border-radius:5px;
                    cursor:pointer;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#1a2a3b'" onmouseout="this.style.background='#233d4c'">
                    🔄 Actualiser
                </button>
            </div>
        `;

        // Ajouter l'événement pour le bouton actualiser
        document.getElementById("retryBtn").addEventListener("click", () => {
            location.reload();
        });
        showToast("loadFail");
    }
}

/* ===================================================== */
/* ================= DROPDOWN VILLES ================= */
const dropbtn = document.querySelector(".dropbtn");
const dropdownContent = document.getElementById("cityDropdown");

// Ouvrir / fermer le dropdown au clic
dropbtn.addEventListener("click", () => {
    dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
});

// Fermer le dropdown si clic en dehors
window.addEventListener("click", (e) => {
    if (!e.target.matches(".dropbtn")) {
        dropdownContent.style.display = "none";
    }
});

// Quand on sélectionne une ville
dropdownContent.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", (e) => {
        e.preventDefault();

        // Mettre à jour la ville sélectionnée
        villeSelectionnee = a.textContent;
        dropbtn.textContent = villeSelectionnee + " ▼";

        // Fermer le dropdown
        dropdownContent.style.display = "none";

        // Recharger les annonces filtrées
        afficherAnnoncesParGroupes(villeSelectionnee);
    });
});

let deferredPrompt; 
const pwaPrompt = document.getElementById('pwaPrompt');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('dismissBtn');

// Création overlay spinner pour l'installation
const loaderOverlay = document.createElement('div');
loaderOverlay.id = "loader-install";
loaderOverlay.style.position = "fixed";
loaderOverlay.style.top = "0";
loaderOverlay.style.left = "0";
loaderOverlay.style.width = "100%";
loaderOverlay.style.height = "100%";
loaderOverlay.style.background = "rgba(255,255,255,0.85)";
loaderOverlay.style.backdropFilter = "blur(3px)";
loaderOverlay.style.display = "flex";
loaderOverlay.style.flexDirection = "column";
loaderOverlay.style.justifyContent = "center";
loaderOverlay.style.alignItems = "center";
loaderOverlay.style.zIndex = "2000";
loaderOverlay.style.display = "none"; // caché par défaut
loaderOverlay.innerHTML = `
    <div class="spinner" style="
        border: 6px solid #f3f3f3;
        border-top: 6px solid #233d4c;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        animation: spin 1s linear infinite;
        margin-bottom: 15px;
    "></div>
    <p style="font-size:18px; color:#233d4c; font-weight:bold;">Installation en cours...</p>
`;
document.body.appendChild(loaderOverlay);

// Animation CSS du spinner
const style = document.createElement('style');
style.innerHTML = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;
document.head.appendChild(style);

// Intercepter l'événement beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); 
    deferredPrompt = e;  
});

// Vérifier si PWA déjà installée
function isPwaInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function showIOSPrompt() {
    if (isPwaInstalled()) return;
    if (!isIOS()) return;

    // Vérifier si déjà montré récemment
    const lastShown = localStorage.getItem("iosPromptShown");
    if (lastShown && Date.now() - Number(lastShown) < 24 * 60 * 60 * 1000) return;

    const iosOverlay = document.createElement("div");
    iosOverlay.id = "iosInstallPrompt";
    iosOverlay.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background: #fff;
        border-radius: 20px 20px 0 0;
        padding: 25px 20px;
        box-shadow: 0 -5px 30px rgba(0,0,0,0.2);
        z-index: 99999;
        text-align: center;
        font-family: 'Segoe UI', sans-serif;
        animation: slideUp 0.3s ease;
    `;

    iosOverlay.innerHTML = `
        <div style="width:40px; height:4px; background:#ddd; border-radius:2px; margin:0 auto 15px;"></div>
        <img src="icons/chezmoi_icon512.png" style="width:60px; height:60px; border-radius:14px; margin-bottom:10px;">
        <h3 style="font-size:18px; color:#233d4c; margin-bottom:8px;">Installer ChezMoi</h3>
        <p style="font-size:14px; color:#555; margin-bottom:20px; line-height:1.6;">
            Pour installer l'app sur votre iPhone :
        </p>
        <div style="display:flex; flex-direction:column; gap:12px; text-align:left; background:#f9f9f9; padding:15px; border-radius:12px; margin-bottom:20px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:22px;">1️⃣</span>
                <span style="font-size:14px; color:#333;">Appuyez sur <strong>Partager</strong> <span style="font-size:16px;">⬆️</span> en bas de Safari</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:22px;">2️⃣</span>
                <span style="font-size:14px; color:#333;">Faites défiler et appuyez sur <strong>"Sur l'écran d'accueil"</strong></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:22px;">3️⃣</span>
                <span style="font-size:14px; color:#333;">Appuyez sur <strong>"Ajouter"</strong> en haut à droite</span>
            </div>
        </div>
        <button id="closeIOSPrompt" style="
            width:100%;
            padding:14px;
            background:#233d4c;
            color:#fd802e;
            border:none;
            border-radius:12px;
            font-size:16px;
            font-weight:600;
            cursor:pointer;
        ">J'ai compris !</button>
    `;

    document.body.appendChild(iosOverlay);
    localStorage.setItem("iosPromptShown", Date.now().toString());

    document.getElementById("closeIOSPrompt").addEventListener("click", () => {
        iosOverlay.style.animation = "slideDown 0.3s ease";
        setTimeout(() => iosOverlay.remove(), 300);
    });
}

// Afficher le popup
function showPwaPrompt() {
    if (!isPwaInstalled()) {
        pwaPrompt.style.display = "flex";
        setTimeout(() => pwaPrompt.classList.add("show"), 50);
    }
}

// Cacher le popup
function hidePwaPrompt() {
    pwaPrompt.classList.remove("show");
    setTimeout(() => pwaPrompt.style.display = "none", 300);
}

// Bouton Installer
installBtn.addEventListener('click', async () => {
    hidePwaPrompt();
    if (!deferredPrompt) {
        showToast("info", "⚠️ Impossible d’installer. Rafraîchissez la page et réessayez.");
        return;
    }

    // Afficher le spinner
    loaderOverlay.style.display = "flex";

    // Lancer l'installation
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // Cacher le spinner
    loaderOverlay.style.display = "none";

    if (outcome === "accepted") {
        showToast("info", "✅ Installation acceptée !");
    } else {
        showToast("info", "Installation annulée par l'utilisateur.");
    }

    deferredPrompt = null;
});

// Détecter PWA installée
window.addEventListener('appinstalled', () => {
    loaderOverlay.style.display = "none"; // s'assure que le spinner est caché
    showToast("info", "✅ ChezMoi est maintenant installé sur votre appareil !");
});

// Bouton Fermer
dismissBtn.addEventListener('click', hidePwaPrompt);

// Affichage automatique toutes les 2 minutes (au lieu de 5)
document.addEventListener('DOMContentLoaded', () => {
    showPwaPrompt();
    showIOSPrompt();
    setInterval(showPwaPrompt, 2 * 60 * 1000);
});

/* ===================================================== */
/* ================= WIZARD AJOUTER =================== */
/* ===================================================== */
let currentStep = 1;
const totalSteps = 6; // étapes 1 à 6 (6 = photos)

function goToStep(step) {
    // Cacher panel actuel
    document.getElementById(`panel-${currentStep}`).classList.remove("active");
    document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove("active");
    document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add("completed");

    // Mettre à jour les lignes
    const lines = document.querySelectorAll(".wizard-line");
    if (step > currentStep) {
        lines[currentStep - 1].classList.add("completed");
    } else {
        lines[step - 1].classList.remove("completed");
        document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove("completed");
    }

    currentStep = step;

    // Afficher nouveau panel
    document.getElementById(`panel-${currentStep}`).classList.add("active");
    document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove("completed");
    document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add("active");

    // Gérer boutons
    const btnPrev = document.getElementById("btnPrecedent");
    const btnNext = document.getElementById("btnSuivant");
    const btnPublier = document.getElementById("btnPublier");

    btnPrev.style.display = currentStep === 1 ? "none" : "block";
    btnNext.style.display = currentStep === totalSteps ? "none" : "block";
    btnPublier.style.display = currentStep === totalSteps ? "block" : "none";

    // Scroll en haut
    document.getElementById("ajouter").scrollTop = 0;
}

function validerEtape(step) {
    if (step === 1) {
        const titre = document.querySelector('input[name="titre"]:checked');
        if (!titre) { showToast("info", "Choisissez un type d'annonce."); return false; }
    }
    if (step === 2) {
        const type = document.querySelector('input[name="type"]:checked');
        if (!type) { showToast("info", "Choisissez un type de logement."); return false; }
    }
    if (step === 3) {
        const ville = document.querySelector('input[name="ville"]:checked');
        const quartier = document.getElementById("quartier").value.trim();
        if (!ville) { showToast("info", "Choisissez une ville."); return false; }
        if (!quartier) { showToast("info", "Entrez le quartier."); return false; }
    }

    if (step === 4) {
        const douche = document.querySelector('input[name="douche"]:checked');
        if (!douche) { showToast("info", "Choisissez le type de douche."); return false; }
    }
    if (step === 5) {
        const chambres = document.getElementById("nbChambres").value;
        const pieces = document.getElementById("nbPieces").value;
        const prix = document.getElementById("prix").value;
        const description = document.getElementById("description").value.trim();
        const contact = document.getElementById("contactAnnonce").value.trim();
        if (!chambres || chambres < 0) { showToast("info", "Indiquez le nombre de chambres."); return false; }
        if (!pieces || pieces < 0) { showToast("info", "Indiquez le nombre de pièces."); return false; }
        if (!prix || prix <= 0) { showToast("info", "Entrez un prix valide."); return false; }
        if (!description) { showToast("info", "Ajoutez une description."); return false; }
        if (!contact) { showToast("info", "Ajoutez un numéro de contact."); return false; }
    }
    if (step === 6) {
        const photos = document.getElementById("photos").files;
        if (photos.length === 0) { showToast("info", "Ajoutez au moins une photo."); return false; }
    }
    return true;
}

document.getElementById("btnSuivant").addEventListener("click", () => {
    if (validerEtape(currentStep)) {
        goToStep(currentStep + 1);
    }
});

document.getElementById("btnPrecedent").addEventListener("click", () => {
    goToStep(currentStep - 1);
});

// Reset wizard quand on quitte la page
const originalResetFormulaire = window.resetFormulaire;
function resetFormulaire() {
    if(formAjouter) formAjouter.reset();
    selectedFiles = [];
    packSelectionne = 0;
    if(extraImagesSlider) extraImagesSlider.value = 0;
    if(extraImagesValue) extraImagesValue.textContent = 0;
    renderGrid();
    updatePrixTotal();
    // Reset wizard à l'étape 1
    if (currentStep !== 1) {
        document.getElementById(`panel-${currentStep}`)?.classList.remove("active");
        document.querySelector(`.wizard-step[data-step="${currentStep}"]`)?.classList.remove("active");
        document.querySelector(`.wizard-step[data-step="${currentStep}"]`)?.classList.remove("completed");
        currentStep = 1;
        document.getElementById("panel-1")?.classList.add("active");
        document.querySelector('.wizard-step[data-step="1"]')?.classList.add("active");
        document.querySelectorAll(".wizard-step").forEach(s => s.classList.remove("completed"));
        document.querySelectorAll(".wizard-line").forEach(l => l.classList.remove("completed"));
        const btnPrev = document.getElementById("btnPrecedent");
        const btnNext = document.getElementById("btnSuivant");
        const btnPublier = document.getElementById("btnPublier");
        if(btnPrev) btnPrev.style.display = "none";
        if(btnNext) btnNext.style.display = "block";
        if(btnPublier) btnPublier.style.display = "none";
    }
}

/* ============================= */
/* GOOGLE AUTH                   */
/* ============================= */
let _googleIdToken = null;

async function loginAvecGoogle(mode) {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        const idToken = await user.getIdToken();
        const nom = user.displayName || "";
        const email = user.email || "";

        if (mode === "inscription") {
            // Pré-remplir nom et email
            const nomInput = document.getElementById("ins-nom");
            const emailInput = document.getElementById("ins-email");
            nomInput.value = nom;
            emailInput.value = email;
            nomInput.classList.add("google-prefilled");
            emailInput.classList.add("google-prefilled");

            // Cacher le mot de passe
            const pwdWrap = document.getElementById("ins-pwd-wrap");
            if (pwdWrap) pwdWrap.style.display = "none";
            const pwdInput = document.getElementById("ins-password");
            if (pwdInput) pwdInput.removeAttribute("required");

            // Stocker le token
            _googleIdToken = idToken;

            // Afficher le banner
            document.getElementById("bannerInscription").classList.add("show");

            // Focus sur le numéro
            document.getElementById("contact").focus();

            showToast("info", "✅ Infos Google importées ! Renseignez juste votre numéro.");

        } else {
            // CONNEXION directe
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
                    if (data.message === "user_not_found") {
                        showToast("info", "Compte introuvable. Créez un compte d'abord !");
                        const nomInput = document.getElementById("ins-nom");
                        const emailInput = document.getElementById("ins-email");
                        if (nomInput) { nomInput.value = nom; nomInput.classList.add("google-prefilled"); }
                        if (emailInput) { emailInput.value = email; emailInput.classList.add("google-prefilled"); }
                        const pwdWrap = document.getElementById("ins-pwd-wrap");
                        if (pwdWrap) pwdWrap.style.display = "none";
                        const pwdInput = document.getElementById("ins-password");
                        if (pwdInput) pwdInput.removeAttribute("required");
                        _googleIdToken = idToken;
                        document.getElementById("bannerInscription").classList.add("show");
                        afficherPage("inscription");
                        return;
                    }
                    throw new Error(data.message);
                }

                currentUserUid = data.uid;
                localStorage.setItem("uid", data.uid);

                try {
                    const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
                    favorisLocal = await favRes.json();
                } catch { favorisLocal = []; }

                showToast("info", "✅ Connecté avec Google !");
                afficherPage("home");
                afficherAnnoncesParGroupes(villeSelectionnee);

            } catch (err) {
                if (loaderCon) loaderCon.style.display = "none";
                showToast("loadFail");
            }
        }

    } catch (err) {
        if (err.code === "auth/popup-closed-by-user") return;
        showToast("loadFail");
    }
}

// Attacher les boutons Google
const btnGoogleIns = document.getElementById("btnGoogleInscription");
const btnGoogleCon = document.getElementById("btnGoogleConnexion");
if (btnGoogleIns) btnGoogleIns.addEventListener("click", () => loginAvecGoogle("inscription"));
if (btnGoogleCon) btnGoogleCon.addEventListener("click", () => loginAvecGoogle("connexion"));

/* ============================= */
/* INSCRIPTION                   */
/* ============================= */
const form = document.getElementById("formInscription");
const loader = document.getElementById("loader");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    loader.classList.add("show");

    const nom = document.getElementById("ins-nom").value.trim();
    const email = document.getElementById("ins-email").value.trim();
    const inscontact = document.getElementById("contact").value.trim();

    // CAS 1 : venu via Google
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

            try {
                const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
                favorisLocal = await favRes.json();
            } catch { favorisLocal = []; }

            showToast("info", "🎉 Compte créé avec Google !");
            afficherPage("home");

        } catch (err) {
            loader.classList.remove("show");
            showToast("loadFail");
        }
        return;
    }

    // CAS 2 : inscription classique
    const password = document.getElementById("ins-password").value;

    try {
        const res = await fetch(`${API_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nom, email, password, inscontact })
        });
        const data = await res.json();
        loader.classList.remove("show");
        if (!res.ok) throw new Error(data.message);

        showToast("info", "🎉 Inscription réussie !");
        currentUserUid = data.uid;
        localStorage.setItem("uid", data.uid);

        try {
            const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
            favorisLocal = await favRes.json();
        } catch { favorisLocal = []; }

        afficherPage("home");

    } catch (err) {
        loader.classList.remove("show");
        showToast("loadFail");
    }
});

/* ============================= */
/* CONNEXION                     */
/* ============================= */
async function loginUser() {
    const email = document.getElementById("con-email").value.trim();
    const password = document.getElementById("con-password").value;
    const loaderCon = document.getElementById("loader-connexion");

    try {
        loaderCon.style.display = "flex";
        const res = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        loaderCon.style.display = "none";
        if (!res.ok) throw new Error(data.message);

        showToast("info", "✅ Connexion réussie !");
        currentUserUid = data.uid;
        localStorage.setItem("uid", data.uid);

        try {
            const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
            favorisLocal = await favRes.json();
        } catch { favorisLocal = []; }

        afficherPage("home");
        afficherAnnoncesParGroupes(villeSelectionnee);

    } catch (err) {
        loaderCon.style.display = "none";
        showToast("loadFail");
    }
}

/* ===========================
/* ==== mot de passe oublié
/* ========================= */
function openModal() {
    document.getElementById("resetModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("resetModal").style.display = "none";
}

function showModalLoader(show = true) {
    document.getElementById("modalLoader").style.display = show ? "flex" : "none";
}

async function sendReset() {
    const email = document.getElementById("resetEmail").value.trim();
    if (!email) {
        showToast("formIncomplete");
        return;
    }

    showModalLoader(true); // bloque l'écran et montre loader

    try {
        const res = await fetch(`${API_URL}/api/password-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await res.json();
        showModalLoader(false);

        if (!res.ok) throw new Error(data.message);

        showToast("info", `✅ Email de réinitialisation envoyé à ${email}`);
        closeModal();

    } catch (err) {
        showModalLoader(false);
        showToast(loadFail);
    }
}

// Lien bouton envoyer
document.getElementById("sendResetBtn").addEventListener("click", sendReset);

/* ============================= */
/* ÉVÉNEMENTS FORMULAIRES */

const formConnexion = document.getElementById("formConnexion");
if (formConnexion) {
    formConnexion.addEventListener("submit", e => {
        e.preventDefault();
        loginUser();
    });
}

// ===============================
// pour la publication
// ===============================
const imageGrid = document.getElementById("imageGrid");
const hiddenInput = document.getElementById("hiddenImageInput");
const imageCounter = document.getElementById("imageCounter");
const imageMax = document.getElementById("imageMax");
const prixTotalSpan = document.getElementById("prixTotal");

let selectedFiles = [];
let packSelectionne = 0; // nombre d'images supplémentaires

const extraImagesSlider = document.getElementById("extraImagesSlider");
const extraImagesValue = document.getElementById("extraImagesValue");

if(extraImagesSlider){

    extraImagesSlider.addEventListener("input", () => {

        packSelectionne = Number(extraImagesSlider.value);

        if(extraImagesValue){
            extraImagesValue.textContent = packSelectionne;
        }

        updateImageCounter();
        updatePrixTotal();

        const maxImages = 5 + packSelectionne;

        if(selectedFiles.length > maxImages){
            selectedFiles = selectedFiles.slice(0, maxImages);
            renderGrid();
        }

    });

}

function updateImageCounter(){
    const maxImages = Math.min(5 + Number(packSelectionne), 15);

    if(imageCounter){
        imageCounter.textContent = selectedFiles.length;
    }

    if(imageMax){
        imageMax.textContent = maxImages;
    }
}

// ================= CALCULER PRIX TOTAL =================
const prixBaseAnnonce = {
    location: 1000,
    vente: 3000
};

const fraisYabetoo = 6; // % de frais

function updatePrixTotal() {
    const selectedType = document.querySelector('input[name="titre"]:checked')?.value?.toLowerCase();
    if(!selectedType) return;

    const base = prixBaseAnnonce[selectedType] || 0;
    const packPrix = Number(packSelectionne) * 200; // 200 XAF par image supplémentaire

    let total = base + packPrix;

    // appliquer les frais Yabetoo pour retrouver montant affiché
    total = total / (1 - fraisYabetoo/100);

    // arrondir au multiple de 5 supérieur
    total = Math.ceil(total / 5) * 5;

    if(prixTotalSpan){
        prixTotalSpan.textContent = total;
    }

    return total;
}

// ================= MODIFIER LA GRILLE =================
function renderGrid() {
    imageGrid.innerHTML = "";

    const maxImages = Math.min(5 + Number(packSelectionne), 15);

    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const card = document.createElement("div");
            card.classList.add("image-card");

            const img = document.createElement("img");
            img.src = e.target.result;
            card.appendChild(img);

            img.addEventListener("click", (ev) => {
                ev.stopPropagation(); // évite conflit avec d’autres clics
                afficherPleinEcran(e.target.result);
            });

            const btnSuppr = document.createElement("div");
            btnSuppr.classList.add("btnSuppr");
            btnSuppr.textContent = "✖";
            btnSuppr.title = "Supprimer";
            btnSuppr.addEventListener("click", (ev) => {
                ev.stopPropagation();
                selectedFiles.splice(index, 1);
                renderGrid();
                updateImageCounter();
            });

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
    updatePrixTotal();
}

// ================= AJOUTER IMAGE =================
hiddenInput.addEventListener("change", () => {
    if(!hiddenInput.files.length) return;

    const files = Array.from(hiddenInput.files);
    const maxImages = Math.min(5 + Number(packSelectionne), 15);
    const MAX_TOTAL_IMAGES = 15;
    const MAX_SIZE_MB = 20;

    for (let file of files) {

        const supportedFormats = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        
        if (!supportedFormats.includes(file.type)) {
            alert(`Le fichier "${file.name}" n'est pas supporté. Formats autorisés : JPEG, PNG, GIF, WEBP`);
            hiddenInput.value = "";
            return;
        }

        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            alert(`L'image "${file.name}" dépasse 20MB`);
            hiddenInput.value = "";
            return;
        }

    }

    if(selectedFiles.length + files.length > Math.min(maxImages, MAX_TOTAL_IMAGES)){
        alert(`Maximum ${Math.min(maxImages, MAX_TOTAL_IMAGES)} images autorisées selon le pack choisi.`);
        hiddenInput.value = "";
        return;
    }

    selectedFiles = [...selectedFiles, ...files].slice(0, MAX_TOTAL_IMAGES);
    renderGrid();
    hiddenInput.value = "";
});

// ================= ACTUALISER PRIX QUAND TYPE CHANGE =================
const typeRadios = document.querySelectorAll('input[name="titre"]'); // Note le All

typeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
        updatePrixTotal();

        const locationFields = document.getElementById("locationOnlyFields");
        if (locationFields) {
            locationFields.style.display = radio.value === "Location" ? "block" : "none";
        }
    });
});

// ================= ACTUALISER TYPE DE CUISINE =================
document.querySelectorAll('input[name="cuisine"]').forEach(radio => {
    radio.addEventListener("change", () => {
        const block = document.getElementById("typeCuisineBlock");
        if(block) block.style.display = radio.value === "oui" ? "block" : "none";
    });
});

// ================= ACTUALISER DISPONIBILITÉ =================
document.querySelectorAll('input[name="disponibilite"]').forEach(radio => {
    radio.addEventListener("change", () => {
        const block = document.getElementById("dispoDateBlock");
        if(block) block.style.display = radio.value === "date" ? "block" : "none";
    });
});

updateImageCounter();
updatePrixTotal();

/* ===================================================== */
/* ================= PLEIN ÉCRAN ====================== */
/* ===================================================== */
let overlayPleinEcran = null;

function afficherPleinEcran(src) {
    // Crée l'overlay si inexistant
    if (!overlayPleinEcran) {
        overlayPleinEcran = document.createElement("div");
        overlayPleinEcran.id = "overlayPleinEcran";
        Object.assign(overlayPleinEcran.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.9)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: "9999",
        });

        const img = document.createElement("img");
        img.id = "imagePleinEcran";
        img.style.maxWidth = "90%";
        img.style.maxHeight = "90%";
        overlayPleinEcran.appendChild(img);

        // Fermer au clic
        overlayPleinEcran.addEventListener("click", () => fermerPleinEcran());

        document.body.appendChild(overlayPleinEcran);
    }

    const img = document.getElementById("imagePleinEcran");
    img.src = src;
    overlayPleinEcran.style.display = "flex";

    // Empile dans l'historique pour capter le bouton retour
    history.pushState({fullscreen: true}, '', '#fullscreen');
}

function fermerPleinEcran(fromPopState = false) {
    if (!overlayPleinEcran) return;

    overlayPleinEcran.style.display = "none";

    // Ne fait history.back() que si ce n'est pas déclenché par popstate
    if (!fromPopState && window.location.hash === "#fullscreen") {
        history.back();
    }
}

// compression d'image avant upload pour réduire la taille et accélérer le processus
async function compressImage(file, maxSizeMB = 5) {
    return new Promise((resolve, reject) => {

        const img = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const reader = new FileReader();

        reader.onload = (e) => img.src = e.target.result;

        img.onload = () => {
            let width = img.width;
            let height = img.height;
            const maxWidth = 1200;

            // redimension proportionnel si trop large
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.8; // qualité initiale
            function tryCompress() {
                canvas.toBlob((blob) => {
                    if (!blob) return reject("Erreur compression");

                    // Si taille OK ou qualité min atteinte, ok
                    if (blob.size / 1024 / 1024 <= maxSizeMB || quality <= 0.3) {
                        resolve(new File([blob], file.name, {
                            type: "image/jpeg",
                            lastModified: Date.now()
                        }));
                    } else {
                        // sinon on réduit la qualité et recommence
                        quality -= 0.1;
                        tryCompress();
                    }
                }, "image/jpeg", quality);
            }

            tryCompress();
        };

        img.onerror = (err) => reject(err);
        reader.readAsDataURL(file);

    });
}

/* ===================================================== */
/* ================= PUBLIER ANNONCE =================== */
/* ===================================================== */
const formAjouter = document.getElementById("formAjouter");
const chargementpub = document.getElementById("loader-pub");

if (formAjouter) {
    formAjouter.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!currentUserUid) {
            showToast("info", "Vous devez être connecté pour publier une annonce.");
            afficherPage("inscription");
            return;
        }

        const titre = document.querySelector('input[name="titre"]:checked')?.value;
        const type = document.querySelector('input[name="type"]:checked')?.value;
        const ville = document.querySelector('input[name="ville"]:checked')?.value;
        const quartier = document.getElementById("quartier").value.trim();
        const douche = document.querySelector('input[name="douche"]:checked')?.value;
        const prix = document.getElementById("prix").value;
        const description = document.getElementById("description").value.trim();
        const contact = document.getElementById("contactAnnonce").value.trim();

        if (!titre || !type || !ville || !quartier || !douche || !prix || !description || !contact) {
            showToast("formIncomplete");
            return;
        }

        if (isNaN(prix) || prix <= 0) {
            showToast("info", "Veuillez entrer un prix valide supérieur à 0");
            return;
        }

        if (selectedFiles.length === 0) {
            showToast("info", "Veuillez sélectionner au moins une image.");
            return;
        }

        chargementpub.style.display = "flex";

        try {
            // Validation rapide des formats (optionnel si déjà fait)
            const supportedFormats = ["image/jpeg", "image/png", "image/gif", "image/webp"];
            for (let file of selectedFiles) {
                if (!supportedFormats.includes(file.type)) {
                    showToast("info", `L'image "${file.name}" n'est pas supportée.`);
                    chargementpub.style.display = "none";
                    return;
                }
            }

            // Création de FormData pour tout envoyer
            const formData = new FormData();
            // uid de l'utilisateur pour associer l'annonce à son compte
            formData.append("uid", currentUserUid);
            // les champs principaux
            formData.append("titre", titre);

            formData.append("type_annonce", type);
            formData.append("description", description);

            formData.append("prix", prix);
            formData.append("ville", ville);

            formData.append("quartier", quartier);
            formData.append("douche", douche);
            
            formData.append("contact", contact);
            formData.append("repere", document.getElementById("repere")?.value?.trim() || "");
            
            formData.append("nbChambres", document.getElementById("nbChambres")?.value || "");
            formData.append("nbPieces", document.getElementById("nbPieces")?.value || "");
            
            formData.append("nbSalons", document.getElementById("nbSalons")?.value || "");
            formData.append("surface", document.getElementById("surface")?.value || "");
            
            formData.append("etage", document.querySelector('input[name="etage"]:checked')?.value || "");
            formData.append("eau", document.querySelector('input[name="eau"]:checked')?.value || "");
            
            formData.append("electricite", document.querySelector('input[name="electricite"]:checked')?.value || "");
            formData.append("parking", document.querySelector('input[name="parking"]:checked')?.value || "");
            
            formData.append("gardien", document.querySelector('input[name="gardien"]:checked')?.value || "");
            formData.append("nbDouches", document.getElementById("nbDouches")?.value || "");
            
            const chargesCocher = [];
            if(document.getElementById("chargesEau")?.checked) chargesCocher.push("eau");
            if(document.getElementById("chargesElec")?.checked) chargesCocher.push("electricite");
            formData.append("charges", chargesCocher.join(","));

            formData.append("climatiseur", document.querySelector('input[name="climatiseur"]:checked')?.value || "");
            
            formData.append("balcon", document.querySelector('input[name="balcon"]:checked')?.value || "");
            formData.append("groupe_electrogene", document.querySelector('input[name="groupe_electrogene"]:checked')?.value || "");
            
            // champs spécifiques pour les locations
            formData.append("forage", document.querySelector('input[name="forage"]:checked')?.value || "");
            formData.append("cuisine", document.querySelector('input[name="cuisine"]:checked')?.value || "");
            
            // si cuisine oui, type de cuisine
            formData.append("type_cuisine", document.querySelector('input[name="type_cuisine"]:checked')?.value || "");
            formData.append("caution", document.getElementById("caution")?.value || "");

            // Avance max pour les locations
            formData.append("avanceMax", document.getElementById("avanceMax")?.value || "");
            formData.append("packSelectionne", packSelectionne || 0);
            
            // équipements
            formData.append("toilettes", document.querySelector('input[name="toilettes"]:checked')?.value || "");
            formData.append("meuble", document.querySelector('input[name="meuble"]:checked')?.value || "");
            formData.append("disponibilite", document.querySelector('input[name="disponibilite"]:checked')?.value || "");
            formData.append("disponibiliteDate", document.getElementById("disponibiliteDate")?.value || "");
            formData.append("wifi", document.querySelector('input[name="wifi"]:checked')?.value || "");
            
            // champs de gestion
            formData.append("statut", "pending_payment");
            formData.append("statut_numero", "verrouille"); // le numéro est masqué par défaut
            formData.append("date_deblocage", "");// pas encore débloqué

            for (let file of selectedFiles) {

                const compressedFile = await compressImage(file);

                formData.append("images", compressedFile);

            }

            // Envoi au backend
            const annonceResponse = await fetch(`${API_URL}/api/annonces`, {
                method: "POST",
                body: formData
            });

            const annonceData = await annonceResponse.json();
            if (!annonceResponse.ok) throw new Error(annonceData.message);

            // Ensuite tu peux créer la session de paiement comme avant
            const paiementResponse = await fetch(`${API_URL}/api/create-annonce-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid: currentUserUid,
                    titre: titre,
                    packSelectionne: packSelectionne || 0,
                    annonceId: annonceData.id ,
                })
            });

            const paiementData = await paiementResponse.json();
            if (!paiementResponse.ok) throw new Error(paiementData.message);

            // On remplace l'état actuel pour enlever la page de paiement de l'historique
            history.replaceState({ page: "home" }, '', '#home');
            window.location.replace(paiementData.redirectUrl);

        } catch (error) {
            console.error("Erreur JS :", error);
            showToast("loadFail");
            chargementpub.style.display = "none";
        }
    });
}

// Initialisation de la grille au chargement
renderGrid();

// Vider le formulaire dès que la page se charge
window.addEventListener("DOMContentLoaded", () => {
    resetFormulaire();
});

// Vider le formulaire si l'utilisateur quitte la page
window.addEventListener("beforeunload", () => {
    resetFormulaire();
});

/* ===================================================== */
/* ================= AFFICHAGE DÉTAIL ================= */
/* ===================================================== */
async function afficherDetailAnnonce() {
    const data = localStorage.getItem("annonceDetail");
    if (!data) return;

    const annonce = JSON.parse(data);

    // Calculer jours restants
    const expirationEl = document.getElementById("detailexpiration");
    const joursRestants = getJoursRestants(annonce.expireAt);

    if (joursRestants <= 0) {
        expirationEl.textContent = "Annonce expirée";
        expirationEl.style.color = "red";
        expirationEl.style.display = "inline";
    } else if (joursRestants <= 2) {
        expirationEl.textContent = "⚠️ Expire dans " + joursRestants + " jours";
        expirationEl.style.color = "red";
        expirationEl.style.display = "inline";
    } else if (joursRestants <= 7) {
        expirationEl.textContent = "Expire dans " + joursRestants + " jours";
        expirationEl.style.color = "orange";
        expirationEl.style.display = "inline";
    } else {
        expirationEl.style.display = "none";
    }

    // Remplir les champs
    document.getElementById("detailTitre").textContent = annonce.titre || "";
    document.getElementById("detaillogement").textContent = annonce.type_annonce || "";
    document.getElementById("detailDescription").textContent = annonce.description || "";
    document.getElementById("detailVille").textContent = annonce.ville || "";
    document.getElementById("detailQuartier").textContent = annonce.quartier || "";
    document.getElementById("detailDouche").textContent = annonce.douche || "";
    document.getElementById("detailPrix").textContent = annonce.prix || "";
    const contactEl = document.getElementById("detailContact");

    // Afficher les images en slider
    const imagesContainer = document.getElementById("detailImages");
    const paginationContainer = document.getElementById("sliderPagination");
    imagesContainer.innerHTML = "";
    paginationContainer.innerHTML = "";

    const images = (annonce.images && annonce.images.length > 0) ? annonce.images : ["image/logo_ChezMoi.png"];

    // imagesContainer et paginationContainer déjà définis
    images.forEach((img, index) => {
        const imageEl = document.createElement("img");
        imageEl.src = img;
        imageEl.alt = annonce.titre;
        imagesContainer.appendChild(imageEl);

        imageEl.addEventListener("click", () => afficherImageFullscreen(img));

        // point pagination
        const dot = document.createElement("span");
        if (index === 0) dot.classList.add("active");
        paginationContainer.appendChild(dot);
    });

    // Pagination dynamique
    function updatePagination() {
        const scrollLeft = imagesContainer.scrollLeft;
        const imageWidth = imagesContainer.clientWidth; // largeur visible du slider
        const index = Math.round(scrollLeft / imageWidth);

        const dots = paginationContainer.querySelectorAll("span");
        dots.forEach((dot, i) => {
            dot.classList.toggle("active", i === index);
        });
    }

    imagesContainer.addEventListener("scroll", updatePagination);
    window.addEventListener("resize", updatePagination); // recalcul si resize

    const indicator = document.getElementById("detailImagesIndicator");

    function updateIndicator() {
        const scrollLeft = imagesContainer.scrollLeft;
        const imageWidth = imagesContainer.clientWidth;
        const index = Math.round(scrollLeft / imageWidth) + 1; // +1 pour que ça commence à 1
        const total = images.length;

        if(indicator) indicator.textContent = `${index} / ${total}`;
    }

    // Mettre à jour au scroll et au resize
    imagesContainer.addEventListener("scroll", updateIndicator);
    window.addEventListener("resize", updateIndicator);

    // Initialiser au début
    updateIndicator();

    // Bouton débloquer contact
    const btnDebloquer = document.getElementById("btnDebloquerContact");
    const titreEl = document.getElementById("detailTitre");

    // Vérifier si déjà débloqué
    const maintenant = new Date();
    if (annonce.statut_numero === "debloque" && annonce.expire_deblocage) {
        const expireDeblocage = new Date(annonce.expire_deblocage._seconds * 1000);
        if (maintenant < expireDeblocage) {
            // Numéro débloqué et pas encore expiré
            contactEl.textContent = annonce.contact;
            if (titreEl) titreEl.textContent = annonce.titre_negociation || "En cours de négociation";
            if (btnDebloquer) {
                btnDebloquer.textContent = "✅ Contact débloqué";
                btnDebloquer.disabled = true;
                btnDebloquer.style.opacity = "0.5";
                btnDebloquer.style.cursor = "not-allowed";

                // Afficher date d'expiration
                const joursRestants = Math.ceil((expireDeblocage - maintenant) / (1000 * 60 * 60 * 24));
                const expireEl = document.getElementById("detailexpiration");
                if (expireEl) {
                    expireEl.textContent = `📞 Contact disponible encore ${joursRestants} jour(s)`;
                    expireEl.style.color = "#fd802e";
                    expireEl.style.display = "inline";
                }
            }
        }
    } else {
        // Numéro verrouillé
        contactEl.textContent = "🔒 Numéro verrouillé";
        if (btnDebloquer) {
            btnDebloquer.addEventListener("click", async () => {
                if (!currentUserUid) {
                    showToast("info", "Vous devez être connecté pour débloquer un contact.");
                    afficherPage("inscription");
                    return;
                }

                const payload = {
                    amount: 1060,
                    annonceId: annonce.id,
                    description: "Déblocage contact propriétaire",
                    name: currentUserUid,
                    msisdn: currentUserUid,
                    provider: "chezmoi",
                    uid: currentUserUid
                };

                try {
                    const response = await fetch(`${API_URL}/api/payment/deblocage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    if (response.ok) {
                        history.replaceState({ page: "detail" }, '', '#detail');
                        window.location.replace(data.redirectUrl);
                    } else {
                        showToast("paymentFail");
                    }
                } catch (err) {
                    console.error("Erreur frontend paiement :", err);
                    showToast("serverDown");
                }
            });
        }
    }
}

// Fonction unique pour plein écran
function afficherImageFullscreen(src) {
    let overlay = document.getElementById("imageFullscreenOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "imageFullscreenOverlay";
        Object.assign(overlay.style, {
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "pointer"
        });

        const fullscreenImg = document.createElement("img");
        fullscreenImg.id = "fullscreenImg";
        fullscreenImg.style.maxWidth = "90%";
        fullscreenImg.style.maxHeight = "90%";
        overlay.appendChild(fullscreenImg);
        document.body.appendChild(overlay);

        overlay.addEventListener("click", () => overlay.style.display = "none");
        document.addEventListener("keydown", e => { if(e.key === "Escape") overlay.style.display = "none"; });
    }

    document.getElementById("fullscreenImg").src = src;
    overlay.style.display = "flex";
}

/* ============================= */
/* FORMULAIRE SIGNALER UN PROBLEME */
/* ============================= */
const pbBtn = document.getElementById("btnSignalerProbleme");
const formSignalerProbleme = document.getElementById("formSignalerProbleme");
const signalerLoader = document.getElementById("loader-signaler");

// Fonction pour ouvrir le formulaire et stocker l'annonce
function signalerAnnonceCourante(annonce) {
    if(!annonce){
        showToast("info", "Aucune annonce sélectionnée.");
        return;
    }
    localStorage.setItem("annonceProbleme", JSON.stringify(annonce));
    afficherPage("signalerProbleme");
}

// Lors du clic sur le bouton "Signaler un problème"
if(pbBtn){
    pbBtn.addEventListener("click", ()=> {
        const annonce = JSON.parse(localStorage.getItem("annonceDetail")); // annonce en cours
        signalerAnnonceCourante(annonce);
    });
}

// Soumission du formulaire
if (formSignalerProbleme) {
    formSignalerProbleme.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Vérifier connexion
        const uid = localStorage.getItem("uid");
        if (!uid) {
            showToast("info", "Vous devez être connecté pour voir vos favoris.");
            afficherPage("inscription")
            return;
        }

        // Vérifier description
        const descriptionInput = document.getElementById("problemeDescription");
        const description = descriptionInput.value.trim();
        if (!description) {
            showToast("info", "Veuillez décrire le problème.");
            return;
        }

        // Récupérer l'annonce liée
        const annonce = JSON.parse(localStorage.getItem("annonceProbleme"));
        if (!annonce) {
            showToast("info", "Aucune annonce sélectionnée.");
            return;
        }

        signalerLoader.style.display = "flex";

        try {
            // Récupérer infos utilisateur
            const userRes = await fetch(`${API_URL}/api/user/${uid}`);
            if (!userRes.ok) throw new Error("Impossible de récupérer les infos utilisateur");
            const user = await userRes.json();

            // Préparer les données
            const bodyData = {
                nom: user.nom,
                email: user.email,
                sujet: `Problème sur l'annonce : ${annonce.titre}`,
                message: description,
                annonce: {
                    id: annonce.id,
                    titre: annonce.titre,
                    type: annonce.type_annonce,
                    ville: annonce.ville,
                    quartier: annonce.quartier,
                    prix: annonce.prix
                }
            };

            // Envoi au serveur
            const response = await fetch(`${API_URL}/api/report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();

            if (!response.ok) {
                showToast("serverDown");
                return;
            }

            // Succès
            signalerLoader.style.display = "none";
            showToast("success");
            descriptionInput.value = "";
            localStorage.removeItem("annonceProbleme");
            afficherPage("home");

        } catch (err) {
            signalerLoader.style.display = "none";
            console.error("Erreur JS signaler problème :", err);
            showToast("loadFail");
        }
    });
}

/* ===================================================== */
/* ======= FORMULAIRE PROPOSER UNE IDEE ================= */
/* ===================================================== */

const formProposerIdee = document.getElementById("formProposerIdee");
const ideeLoader = document.getElementById("loader-idee");

if(formProposerIdee){

    formProposerIdee.addEventListener("submit", async (e)=>{

        e.preventDefault();

        const uid = localStorage.getItem("uid");

        if(!uid){
            showToast("info", "Vous devez être connecté pour voir vos favoris.");
            afficherPage("inscription")
            return;
        }

        const titreInput = document.getElementById("ideeTitre");
        const descriptionInput = document.getElementById("ideeDescription");

        const titre = titreInput.value.trim();
        const description = descriptionInput.value.trim();

        if(!titre || !description){
            showToast("formIncomplete");
            return;
        }

        ideeLoader.style.display = "flex";

        try{

            // récupérer infos utilisateur
            const userRes = await fetch(`${API_URL}/api/user/${uid}`);
            if(!userRes.ok) throw new Error("Impossible de récupérer les infos utilisateur");

            const user = await userRes.json();

            const bodyData = {
                nom: user.nom,
                email: user.email,
                sujet: titre,
                message: description
            };

            const response = await fetch(`${API_URL}/api/idea`, {
                method: "POST",
                headers: { "Content-Type":"application/json" },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();

            if(!response.ok){
                showToast("serverDown");
                return;
            }

            ideeLoader.style.display = "none";

            showToast("info", "Merci pour votre idée ❤️");

            titreInput.value = "";
            descriptionInput.value = "";

            afficherPage("home");

        }catch(err){

            ideeLoader.style.display = "none";

            console.error("Erreur JS idée :", err);

            showToast("serverDown");
        }

    });

}

/* ============================= */
/* BOUTON RECHERCHE              */
/* ============================= */
const searchBtn = document.getElementById("searchBtn");
if(searchBtn){
    searchBtn.addEventListener("click", ()=> afficherPage("recherche"));
}
/* ===================================================== */
/* =================== RECHERCHE LOGEMENTS ============ */
/* ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    const villeFilter = document.getElementById("villeFilter");
    const typeFilter = document.getElementById("typeFilter");
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");

    let annonces = []; // contiendra toutes les annonces récupérées

    // ======= FETCH DES ANNONCES =======
    async function chargerAnnonces() {
        try {
            const response = await fetch(`${API_URL}/api/annonces`);
            if (!response.ok) throw new Error("Erreur serveur lors du chargement des annonces");
            annonces = await response.json();
            afficherAnnonces(); // affichage initial
        } catch (err) {
            searchResults.innerHTML = `<p style="text-align:center; font-size:18px; margin-top:50px; color:red;">
                Erreur de chargement des annonces.\n Vérifiez votre connexion internet.
            </p>`;
            console.error(err);
        }
    }

    // ======= AFFICHAGE DES ANNONCES FILTRÉES =======
    function afficherAnnonces() {
        const ville = villeFilter.value.toLowerCase();
        const type = typeFilter.value.toLowerCase();
        const rechercheTexte = searchInput.value.toLowerCase();

        // ====== Déterminer si aucun filtre n'est appliqué ======
        const aucunFiltre = ville === "toutes les villes" && type === "toutes les catégories" && rechercheTexte === "";
        let annoncesAFiltrer = annonces;

        if (aucunFiltre) {
            // Échantillon aléatoire : 1 annonce par catégorie
            annoncesAFiltrer = [];
            const categories = [...new Set(annonces.map(a => a.type_annonce))]; // toutes les catégories existantes

            categories.forEach(cat => {
                const annoncesCat = annonces.filter(a => a.type_annonce === cat);
                if (annoncesCat.length > 0) {
                    const randomIndex = Math.floor(Math.random() * annoncesCat.length);
                    annoncesAFiltrer.push(annoncesCat[randomIndex]);
                }
            });
        } else {
            // filtrage normal selon ville, type, texte
            annoncesAFiltrer = annonces.filter(a => {
                const villeOk = ville === "toutes les villes" || a.ville?.toLowerCase() === ville;
                const typeOk = type === "toutes les catégories" || a.type_annonce?.toLowerCase() === type;
                const texteOk = !rechercheTexte ||
                    a.ville?.toLowerCase().includes(rechercheTexte) ||
                    a.type_annonce?.toLowerCase().includes(rechercheTexte) ||
                    (a.prix ? a.prix.toString().includes(rechercheTexte) : false);
                return villeOk && typeOk && texteOk;
            });
        }

        // ====== Vider les résultats avant affichage ======
        searchResults.innerHTML = "";

        if (annoncesAFiltrer.length === 0) {
            searchResults.innerHTML = `<p style="text-align:center; font-size:16px; margin-top:20px;">
                Aucune annonce trouvée.
            </p>`;
            return;
        }

        // ====== Créer les cartes ======
        annoncesAFiltrer.forEach(annonce => {
            const joursRestants = getJoursRestants(annonce.expireAt);
            const card = document.createElement("div");
            card.className = "search-card";

            const imgSrc = (annonce.images && annonce.images.length > 0) ? annonce.images[0] : "image/logo_ChezMoi.png";

            card.innerHTML = `
                <img src="${imgSrc}" alt="${annonce.titre}">

                <div class="search-card-content">
                    <h3>${annonce.titre || "Logement disponible"}</h3>
                    ${joursRestants !== null && joursRestants <= 7
                        ? `<div class="expire-info ${joursRestants <= 2 ? "urgent" : ""}">
                            ${joursRestants <= 2 
                                ? `⚠ expire dans ${joursRestants} jour(s)` 
                                : ` expire dans ${joursRestants} jour(s)`
                            }
                        </div>` 
                    : ""}

                    <div class="card-infos">
                        <p>🏠 ${annonce.type_annonce || ""}</p>
                        <p>📍 ${annonce.ville || ""}</p>
                        <p class="prix">${annonce.prix ? annonce.prix + " XAF" : ""}</p>
                    </div>

                    <button class="btn-details">Voir</button>
                    <button class="btn-share">
                        <img src="image/partager.png" alt="Partager" class="share-icon">
                    </button>

                    <button class="btn-fav" data-id="${annonce.id}">🤍</button>

                </div>
            `;

            // Bouton "Voir" pour afficher les détails
            card.querySelector(".btn-details").addEventListener("click", () => {
                localStorage.setItem("annonceDetail", JSON.stringify(annonce));
                afficherPage("detail");
                afficherDetailAnnonce();
            });

            searchResults.appendChild(card);
        });
    }
    
    // ======= ÉVÉNEMENTS FILTRES =======
    villeFilter.addEventListener("change", afficherAnnonces);
    typeFilter.addEventListener("change", afficherAnnonces);
    searchInput.addEventListener("input", afficherAnnonces);

    // ======= CHARGEMENT INITIAL =======
    chargerAnnonces();
});

/* ============================= */
/* ====== PAGE EXPLORER ======== */
/* ============================= */

const explorerContainer = document.getElementById("explorerContainer");
const cityDropdown = document.getElementById("cityDropdown");
const chargement = document.getElementById("loader-explore")

let toutesAnnonces = [];


// ================== FETCH ANNONCES ==================
async function chargerToutesAnnonces() {
    if(!explorerContainer) return;
    chargement.style.display = "flex";

    try {
        const res = await fetch(`${API_URL}/api/annonces`);
        if(!res.ok) throw new Error("Erreur serveur");
        const data = await res.json();
        toutesAnnonces = shuffleArray(data); // mélange aléatoire
        chargement.style.display = "none";
        afficherExplorer();
    } catch(err) {
        console.error(err);
        chargement.style.display = "none";
        explorerContainer.innerHTML = `<p style="text-align:center; color:red;">Erreur de chargement.</p>`;
    }
}

// ================== MELANGE ALEATOIRE ==================
function shuffleArray(array) {
    let m = array.length, t, i;
    while(m){
        i = Math.floor(Math.random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
}

// ================== AFFICHAGE CARTES ==================
function afficherExplorer() {
    if(!explorerContainer) return;
    explorerContainer.innerHTML = "";

   // Afficher toutes les annonces, peu importe la ville
    const annoncesFiltres = toutesAnnonces;

    if(annoncesFiltres.length === 0){
        explorerContainer.innerHTML = `<p style="text-align:center; margin-top:50px;">Aucune annonce disponible.</p>`;
        return;
    }

    // Créer un tableau de toutes les images avec leurs infos
    let toutesImages = [];
    annoncesFiltres.forEach(annonce => {
        if(annonce.images && annonce.images.length > 0){
            annonce.images.forEach(img => {
                toutesImages.push({imgSrc: img, annonce});
            });
        } else {
            toutesImages.push({imgSrc: "image/logo_ChezMoi.png", annonce});
        }
    });

    // Mélanger toutes les images
    toutesImages = shuffleArray(toutesImages);

    // Afficher chaque image dans sa propre carte
    toutesImages.forEach(({imgSrc, annonce}, index) => {
        const joursRestants = getJoursRestants(annonce.expireAt);
        const card = document.createElement("div");
        card.className = "explorer-card animate-card";

        // rotation subtile aléatoire
        const rotation = (Math.random() * 4 - 2) + "deg"; // -2 à +2 deg
        card.style.transform = `rotate(${rotation})`;
        card.style.animationDelay = (index * 0.05) + "s";

        card.innerHTML = `
            <img src="${imgSrc}" alt="${annonce.titre}">
            <h3>${annonce.titre || ""}</h3>
            ${joursRestants !== null && joursRestants <= 7
                ? `<div class="expire-info ${joursRestants <= 2 ? "urgent" : ""}">
                    ${joursRestants <= 2 
                        ? `⚠ expire dans ${joursRestants} jour(s)` 
                        : `⏳ expire dans ${joursRestants} jour(s)`
                    }
                </div>` 
            : ""}
            <p>${annonce.type_annonce || ""} - ${annonce.ville || ""}</p>
            <p class="prix">${annonce.prix || ""} XAF</p>
            <button class="btn-decouvrir pulse-btn">Découvrir</button>
            <div class="explorer-buttons">
                <button class="btn-share">
                    <img src="image/partager.png" alt="Partager" class="share-icon">
                </button>
            </div>
        `;

        // plein écran au clic sur l'image
        card.querySelector("img").addEventListener("click", () => afficherPleinEcran(imgSrc));

        // bouton découvrir
        card.querySelector(".btn-decouvrir").addEventListener("click", () => {
            localStorage.setItem("annonceDetail", JSON.stringify(annonce));
            afficherPage("detail");
            afficherDetailAnnonce();
        });

        // Bouton partager
        card.querySelector(".btn-share").addEventListener("click", () => {
            partagerAnnonce(annonce);
        });

        // === AJOUT BOUTON FAVORIS POUR EXPLORER ===
        const isFavori = favorisLocal.includes(annonce.id);
        const favBtnHtml = `<button class="btn-fav" data-id="${annonce.id}">${isFavori ? '❤️' : '🤍'}</button>`;

        // Ajouter le bouton favoris dans explorer-buttons
        const explorerButtonsDiv = card.querySelector(".explorer-buttons");
        explorerButtonsDiv.insertAdjacentHTML("beforeend", favBtnHtml);

        // Setup listener pour ce bouton
        const favBtn = explorerButtonsDiv.querySelector(".btn-fav");
        favBtn.addEventListener("click", async () => {
            if(!currentUserUid){
                // toast d'information
                showToast("info", "Vous devez être connecté pour voir vos favoris.");
                afficherPage("inscription")
                return;
            }

            let isFavorite = favorisLocal.includes(annonce.id);
            isFavorite = await toggleFavorite(currentUserUid, annonce.id, isFavorite);

            // Mise à jour de favorisLocal
            if(isFavorite){
                if(!favorisLocal.includes(annonce.id)) favorisLocal.push(annonce.id);
            } else {
                favorisLocal = favorisLocal.filter(id => id !== annonce.id);
            }

            // Mettre à jour le texte du bouton
            favBtn.textContent = isFavorite ? "❤️" : "🤍";

            // Mettre à jour tous les autres boutons correspondants à cette annonce
            document.querySelectorAll(`.btn-fav[data-id="${annonce.id}"]`).forEach(btn => {
                btn.textContent = isFavorite ? "❤️" : "🤍";
            });

            // Mettre à jour compteur si besoin
            const favorisCount = document.getElementById("favorisCount");
            if(favorisCount){
                favorisCount.textContent = favorisLocal.length;
            }
        });

        explorerContainer.appendChild(card);
    });
}


// ================== FILTRE VILLES ==================
if(dropbtn && cityDropdown){
    dropbtn.addEventListener("click", () => {
        cityDropdown.style.display = cityDropdown.style.display === "block" ? "none" : "block";
    });

    window.addEventListener("click", e => {
        if(!e.target.matches(".dropbtn")) cityDropdown.style.display = "none";
    });

    cityDropdown.querySelectorAll("a").forEach(a => {
        a.addEventListener("click", e => {
            e.preventDefault();
            villeSelectionnee = a.textContent;
            dropbtn.textContent = villeSelectionnee + " ▼";
            cityDropdown.style.display = "none";
            afficherExplorer();
        });
    });
}

// ================== INITIALISATION ==================
chargerToutesAnnonces();


// BOUTON EXPLORER
document.addEventListener("DOMContentLoaded", () => {
    const explorerBtn = document.getElementById("exploreBtn"); // correspond à ton HTML
    if(explorerBtn){
        explorerBtn.addEventListener("click", () => {
            afficherPage("explorer"); // l'id de ta section Explorer
            chargerToutesAnnonces(); // recharge les annonces
        });
    }
});

/* ===================================================== */
/* =================== PAGE PROFIL ===================== */
/* ===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const profileBtn = document.getElementById("profileBtn");
    const profilchargement = document.getElementById("loader-profil");

    if(profileBtn){
        profileBtn.addEventListener("click", async () => {

            if(!currentUserUid){
                // toast d'information
                showToast("info", "Vous devez être connecté pour voir vos favoris.");
                afficherPage("inscription")
                return;
            }

            
            // ==============================
            //  Afficher page profil
            // ==============================
            afficherPage("profil");
            profilchargement.style.display = "flex";

            try{
                // ==============================
                //  Récupérer infos utilisateur
                // ==============================
                const resUser = await fetch(`${API_URL}/api/user/${currentUserUid}`);
                if(!resUser.ok) throw new Error("Erreur récupération utilisateur");

                const user = await resUser.json();

                document.getElementById("userName").textContent = user.nom || "Utilisateur";
                document.getElementById("userEmail").textContent = user.email || "-";
                document.getElementById("userContact").textContent = user.inscontact || "Non renseigné";
                
                // ==============================
                //  Récupérer ses favoris
                // ==============================
                const resFav = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
                if(!resFav.ok) throw new Error("Erreur récupération favoris");

                const favoris = await resFav.json();

                // Mettre à jour le compteur
                document.getElementById("favorisCount").textContent = favoris.length;

                // ==============================
                //  Récupérer ses annonces
                // ==============================
                const resAnnonces = await fetch(`${API_URL}/api/annonces/user/${currentUserUid}`);
                if(!resAnnonces.ok) throw new Error("Erreur récupération annonces");

                const annonces = await resAnnonces.json();

                const container = document.getElementById("userAnnoncesContainer");
                container.innerHTML = "";
                container.style.display = "flex";
                container.style.flexWrap = "wrap";
                container.style.gap = "15px";

                document.getElementById("userAnnonces").textContent = annonces.length;

                if(annonces.length === 0){
                    container.innerHTML = "<p>Aucune annonce publiée.</p>";
                } else {
                    annonces.forEach(annonce => {

                        // calculer jours restants
                        const joursRestants = getJoursRestants(annonce.expireAt)
                        const card = document.createElement("div");
                        card.className = "annonce-card";

                        // Style direct pour simplifier
                        card.style.width = "200px";
                        card.style.border = "1px solid #ddd";
                        card.style.borderRadius = "8px";
                        card.style.overflow = "hidden";
                        card.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
                        card.style.cursor = "pointer";
                        card.style.transition = "transform 0.2s, box-shadow 0.2s";

                        card.addEventListener("mouseenter", () => {
                            card.style.transform = "translateY(-3px)";
                            card.style.boxShadow = "0 5px 15px rgba(0,0,0,0.2)";
                        });
                        card.addEventListener("mouseleave", () => {
                            card.style.transform = "translateY(0)";
                            card.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
                        });

                        const imgSrc = annonce.images?.[0] || "image/logo_ChezMoi.png";

                        card.innerHTML = `
                            <div style="height:120px; overflow:hidden;">
                                <img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover;">
                            </div>
                            ${joursRestants !== null && joursRestants <= 7
                                ? `<div class="expire-info ${joursRestants <= 2 ? "urgent" : ""}">
                                    ${joursRestants <= 2 
                                        ? `⚠ expire dans ${joursRestants} jour(s)` 
                                        : `⏳ expire dans ${joursRestants} jour(s)`
                                    }
                                </div>` 
                            : ""}
                            <div style="padding:10px;">
                                <div style="font-weight:bold; margin-bottom:5px; font-size:16px;">${annonce.titre}</div>
                                <div style="color:#555; font-size:14px;">${annonce.ville}</div>
                                <div style="color:#000; font-weight:bold; margin-top:5px;">${annonce.prix} XAF</div>

                                <button class="btn-delete" style="
                                    margin-top:10px;
                                    width:100%;
                                    padding:6px;
                                    background:#e74c3c;
                                    color:white;
                                    border:none;
                                    border-radius:5px;
                                    cursor:pointer;
                                ">
                                    Supprimer
                                </button>
                            </div>
                        `;

                        // ====== BOUTON SUPPRIMER ======
                        const deleteBtn = card.querySelector(".btn-delete");

                        deleteBtn.addEventListener("click", (e) => {
                            e.stopPropagation();

                            // éviter doublon
                            if (document.querySelector(".confirm-overlay")) return;

                            const overlay = document.createElement("div");
                            overlay.className = "confirm-overlay";

                            overlay.style.position = "fixed";
                            overlay.style.top = "0";
                            overlay.style.left = "0";
                            overlay.style.width = "100%";
                            overlay.style.height = "100%";
                            overlay.style.background = "rgba(0,0,0,0.5)";
                            overlay.style.display = "flex";
                            overlay.style.alignItems = "center";
                            overlay.style.justifyContent = "center";
                            overlay.style.zIndex = "9999";

                            overlay.innerHTML = `
                                <div style="
                                    background:#fff;
                                    padding:20px;
                                    border-radius:10px;
                                    text-align:center;
                                    width:300px;
                                ">
                                    <p style="margin-bottom:15px;">Supprimer cette annonce ?</p>

                                    <button class="yes-btn" style="
                                        background:#e74c3c;
                                        color:white;
                                        border:none;
                                        padding:8px 15px;
                                        border-radius:5px;
                                        margin-right:10px;
                                        cursor:pointer;
                                    ">Oui</button>

                                    <button class="no-btn" style="
                                        background:#ccc;
                                        border:none;
                                        padding:8px 15px;
                                        border-radius:5px;
                                        cursor:pointer;
                                    ">Non</button>
                                </div>
                            `;

                            document.body.appendChild(overlay);

                            // NON
                            overlay.querySelector(".no-btn").onclick = () => {
                                overlay.remove();
                            };

                            // OUI (ton code)
                            overlay.querySelector(".yes-btn").onclick = async () => {
                                try {
                                    const res = await fetch(`${API_URL}/api/annonces/${annonce.id}`, {
                                        method: "DELETE",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ uid: currentUserUid })
                                    });

                                    const data = await res.json();
                                    if(!res.ok) throw new Error(data.message);

                                    showToast("info", "Annonce supprimée !");

                                    card.remove();

                                    const compteur = document.getElementById("userAnnonces");
                                    if(compteur){
                                        compteur.textContent = Number(compteur.textContent) - 1;
                                    }

                                    if(typeof favorisLocal !== "undefined" && favorisLocal.includes(annonce.id)){
                                        favorisLocal = favorisLocal.filter(id => id !== annonce.id);
                                        const fav = document.getElementById("favorisCount");
                                        if(fav){
                                            fav.textContent = favorisLocal.length;
                                        }
                                    }

                                } catch(err){
                                    console.error(err);
                                    showToast("info", "Erreur lors de la suppression, Veuillez réessayer.");
                                }

                                overlay.remove();
                            };
                        });
                        container.appendChild(card);
                    });
                }
                profilchargement.style.display = "none"; // Cache le loader après chargement
            } catch(error){
                profilchargement.style.display = "none"; // Cache le loader
                console.error(error);
                // toast d'erreur
                showToast("loadFail");
            }
        });
    }

});

// ==================== OVERLAY DE CONNEXION ====================
const logoutBtn = document.getElementById("logoutBtn");
const overlay = document.getElementById("loginOverlay");
const savedAccounts = document.getElementById("savedAccounts");
const createAccountBtn = document.getElementById("createAccountBtn");

// ------------------- FONCTION POUR AFFICHER LES COMPTES -------------------
async function afficherComptes() {
    savedAccounts.innerHTML = '';

    try {
        const res = await fetch(`${API_URL}/api/user/accounts`);
        if (!res.ok) throw new Error("Impossible de récupérer les comptes existants");

        const comptesExistants = await res.json();

        comptesExistants.forEach(compte => {
            const div = document.createElement('div');
            div.className = 'account-item';
            div.innerHTML = `
                <img src="${compte.avatar || 'image/avatar.png'}" class="account-avatar" alt="avatar">
                <div class="account-info">
                    <span class="account-name">${compte.nom}</span>
                    <span class="account-email">${compte.email}</span>
                </div>
            `;

            // Cliquer sur un compte → reconnecter
            div.addEventListener('click', () => {
                currentUserUid = compte.uid;
                localStorage.setItem("uid", compte.uid);
                overlay.style.display = 'none';
                showToast("info", `Connecté avec ${compte.nom}`);
                // Ici tu peux rafraîchir le profil si nécessaire
            });

            savedAccounts.appendChild(div);
        });

        if (comptesExistants.length === 0) {
            savedAccounts.innerHTML = "<p>Aucun compte existant trouvé.</p>";
        }

    } catch (err) {
        console.error(err);
        savedAccounts.innerHTML = "<p>Erreur lors de la récupération des comptes.</p>";
    }
}

// -------------------- pour le lien inviter un ami --------------------
const menuBtn = document.getElementById("menuBtn");
const menuContainer = document.querySelector(".dropdown-menu");

menuBtn.addEventListener("click", () => {
    menuContainer.classList.toggle("show");
});

// fermer le menu si on clique ailleurs
window.addEventListener("click", (e) => {
    if (!menuContainer.contains(e.target)) {
        menuContainer.classList.remove("show");
    }
});

// Inviter un ami
document.getElementById("inviteFriendBtn").addEventListener("click", () => {
    const shareData = {
        title: "Chezmoi 🌟",
        text: "Hey ! Rejoins-moi sur ChezMoi, la plateforme qui simplifie la recherche de logement partout dans le monde. Découvre des annonces, contacte facilement les propriétaires et bien plus !",
        url: "https://chezmoi-app.netlify.app"
    };

    if (navigator.share) {
        navigator.share(shareData).catch(err => console.error("Erreur de partage :", err));
    } else {
        navigator.clipboard.writeText(shareData.url)
            .then(() => showToast("clipboardSuccess"))
            .catch(() => showToast("clipboardFail"));
    }

    menuContainer.classList.remove("show");
});

// Proposer une idée / feedback
document.getElementById("feedbackBtn").addEventListener("click", () => {
    // tu peux soit ouvrir un formulaire, soit rediriger vers ta page feedback
    afficherPage("proposerIdee"); // par exemple réutiliser ton formulaire existant
    menuContainer.classList.remove("show");
});

// ------------------- BOUTON DE DÉCONNEXION -------------------
logoutBtn.addEventListener("click", () => {
    if(!currentUserUid){
        // toast d'information
        showToast("info", "Vous devez être connecté pour voir vos favoris.");
        afficherPage("inscription")
        return;
    }
    currentUserUid = null;
    localStorage.removeItem("uid");
    showToast("info", "Déconnecté !");

    // Affiche overlay et comptes uniquement au clic
    overlay.style.display = "flex";
    afficherComptes();
});

// ------------------- BOUTON CRÉER UN COMPTE -------------------
createAccountBtn.addEventListener("click", () => {
    overlay.style.display = "none";
    afficherPage("inscription");
});

// =========================
// ==== modifier profil
// =========================

const editProfileBtn = document.getElementById("editProfileBtn");
const editProfileForm = document.getElementById("editProfileForm");
const closeProfileModal = document.getElementById("closeProfileModal");

const editNameInput = document.getElementById("editName");
const editEmailInput = document.getElementById("editEmail");
const editContactInput = document.getElementById("editContact");
const saveProfileBtn = document.getElementById("saveProfileBtn");

// Ouvrir modal et pré-remplir
editProfileBtn.addEventListener("click", async () => {
    try {
        const res = await fetch(`${API_URL}/api/user/${currentUserUid}`);
        if (!res.ok) throw new Error("Erreur récupération utilisateur");

        const user = await res.json();
        editNameInput.value = user.nom || "";
        editEmailInput.value = user.email || "";
        editContactInput.value = user.inscontact || "";

        editProfileForm.classList.add("active");
    } catch(err) {
        showToast("serverDown");
    }
});

// Fermer modal
closeProfileModal.addEventListener("click", () => {
    editProfileForm.classList.remove("active");
});

// Fermer modal en cliquant en dehors
editProfileForm.addEventListener("click", (e) => {
    if (e.target === editProfileForm) {
        editProfileForm.classList.remove("active");
    }
});

// Sauvegarder modifications
saveProfileBtn.addEventListener("click", async () => {
    const nom = editNameInput.value.trim();
    const email = editEmailInput.value.trim();
    const inscontact = editContactInput.value.trim();
    const editchargement = document.getElementById("loader-edit");
    editchargement.style.display = "flex";

    if(!currentUserUid){
        showToast("info", "Vous devez être connecté pour voir vos favoris.");
        afficherPage("inscription")
        return;
    }

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

        // Mise à jour affichage
        document.getElementById("userName").textContent = nom;
        document.getElementById("userEmail").textContent = email;
        document.getElementById("userContact").textContent = inscontact;

        editProfileForm.classList.remove("active");
    } catch(err) {
        editchargement.style.display = "none";
        showToast("loadFail");
    }
});

// ============================= */
// Bouton "Voir mes favoris"
// ============================= */

const voirFavorisBtn = document.getElementById("voirFavorisBtn");
const chargementfav = document.getElementById("loader-fav")
if(voirFavorisBtn){
    voirFavorisBtn.addEventListener("click", async () => {
        if(!currentUserUid){
            // toast d'information
            showToast("info", "Vous devez être connecté pour voir vos favoris.");
            afficherPage("inscription")
            return;
        }

        // Afficher la page favoris
        afficherPage("favoris");
        // loader
        chargementfav.style.display = "flex"

        const container = document.getElementById("favorisContainer");
        const message = document.getElementById("aucunFavorisMessage");
        container.innerHTML = "";

        try{
            // Récupérer toutes les annonces
            const res = await fetch(`${API_URL}/api/annonces`);
            if(!res.ok) throw new Error("Erreur serveur");
            const toutesAnnonces = await res.json();

            // Filtrer uniquement les annonces favorites
            const annoncesFavorites = toutesAnnonces.filter(a => favorisLocal.includes(a.id));

            if(annoncesFavorites.length === 0){
                message.style.display = "block";
                chargementfav.style.display = "none"
                return;
            } else {
                message.style.display = "none";
            }

            // Créer les cartes comme sur la page home
            annoncesFavorites.forEach(annonce => {
                // calculer jours restants
                const joursRestants = getJoursRestants(annonce.expireAt)

                const card = document.createElement("div");
                card.className = "annonce-card";

                const imgSrc = annonce.images?.[0] || "image/logo_ChezMoi.png";

                card.innerHTML = `
                    <span class="annonce-type">${annonce.titre}</span>
                    ${joursRestants !== null && joursRestants <= 7
                        ? `<div class="expire-info ${joursRestants <= 2 ? "urgent" : ""}">
                            ${joursRestants <= 2 
                                ? `⚠ expire dans ${joursRestants} jour(s)` 
                                : `⏳ expire dans ${joursRestants} jour(s)`
                            }
                        </div>` 
                    : ""}
 
                    <img class="annonce-img" src="${imgSrc}" alt="${annonce.titre}">
                    <div class="type-annonce">
                        <span class="annonce-quartier">${annonce.quartier}</span> - 
                        <span class="annonce-type-text">${annonce.type_annonce || ""}</span>
                    </div>
                    <div class="annonce-footer">
                        <div class="annonce-info">
                            <span class="ville">${annonce.ville}</span>
                            <span class="prix">${annonce.prix} XAF</span>
                        </div>
                        <button class="btn-details">Voir</button>
                        <button class="btn-share">
                            <img src="image/partager.png" alt="Partager" class="share-icon">
                        </button>
                        <button class="btn-fav" data-id="${annonce.id}">❤️</button>
                    </div>
                `;

                container.appendChild(card);

                // Bouton voir
                card.querySelector(".btn-details").addEventListener("click", () => {
                    localStorage.setItem("annonceDetail", JSON.stringify(annonce));
                    afficherPage("detail");
                    afficherDetailAnnonce();
                });

                // Bouton partager
                card.querySelector(".btn-share").addEventListener("click", () => {
                    partagerAnnonce(annonce);
                });

                // Bouton favoris
                let favBtn = card.querySelector(".btn-fav");
                favBtn.replaceWith(favBtn.cloneNode(true));
                favBtn = card.querySelector(".btn-fav");
                setupFavoriButton(favBtn, annonce);
            });

            // on arrete le loader
            chargementfav.style.display = "none"

        } catch(err){
            console.error("Erreur chargement favoris :", err);
            chargementfav.style.display = "none"
            message.textContent = "Erreur lors du chargement des favoris.";
            message.style.display = "block";
        }
    });
}

window.addEventListener("hashchange", async () => {
    const hash = window.location.hash;
    if(hash.startsWith("#annonce-")){
        const annonceId = hash.replace("#annonce-", "");
        try {
            const res = await fetch(`${API_URL}/api/annonces/${annonceId}`);
            if(!res.ok) throw new Error("Annonce introuvable");
            const annonce = await res.json();
            localStorage.setItem("annonceDetail", JSON.stringify(annonce));
            afficherPage("detail");
            afficherDetailAnnonce();
        } catch(err){
            console.error(err);
            showToast("info", "Impossible de charger l'annonce depuis ce lien.");
        }
    } else {
        afficherPage("home");
    }
});

/* ================= DROPDOWN VILLES ================= */
document.addEventListener("DOMContentLoaded", () => {
    const dropbtn = document.querySelector(".dropbtn");
    const cityDropdown = document.getElementById("cityDropdown");

    if (!dropbtn || !cityDropdown) return;

    // Ouvrir / fermer le dropdown au clic
    dropbtn.addEventListener("click", (e) => {
        e.stopPropagation(); // empêche fermeture immédiate
        cityDropdown.style.display = cityDropdown.style.display === "block" ? "none" : "block";
    });

    // Fermer le dropdown si clic en dehors
    window.addEventListener("click", () => {
        cityDropdown.style.display = "none";
    });

    // Quand on sélectionne une ville
    cityDropdown.querySelectorAll("a").forEach(a => {
        a.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation(); // évite fermeture immédiate

            // Mettre à jour la ville sélectionnée et le texte du bouton
            villeSelectionnee = a.textContent;
            dropbtn.textContent = villeSelectionnee + " ▼";

            // Fermer le dropdown
            cityDropdown.style.display = "none";

            // Recharger les annonces selon la page
            if (document.getElementById("explorerContainer")) {
                afficherExplorer();
            } else {
                afficherAnnoncesParGroupes(villeSelectionnee);
            }
        });
    });
});

/* ============================= */
/* memoriser les page */
/* ============================= */
window.addEventListener('popstate', function(event) {
    // Priorité 1 : fermer plein écran formulaire si ouvert
    if (overlayPleinEcran && overlayPleinEcran.style.display === "flex") {
        fermerPleinEcran(true);
        return;
    }

    // Priorité 2 : fermer plein écran detail si ouvert
    const fullscreenOverlay = document.getElementById("imageFullscreenOverlay");
    if (fullscreenOverlay && fullscreenOverlay.style.display === "flex") {
        fullscreenOverlay.style.display = "none";
        return;
    }

    // Priorité 3 : navigation normale entre pages
    let pageId = (event.state && event.state.page) ? event.state.page : 'home';
    if(pageId === 'accueil') pageId = 'home';
    afficherPage.skipHistory = true;
    afficherPage(pageId);
    afficherPage.skipHistory = false;
});

/* ===================================================== */
/* ================= PULL TO REFRESH ================== */
/* ===================================================== */
const homeContent = document.querySelector('.home-content');
const spinner = document.getElementById('pull-spinner');

let touchStartY = 0;
let isPulling = false;
let isRefreshing = false;

homeContent.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    isPulling = false; // reset à chaque début de touch
});

homeContent.addEventListener('touchmove', (e) => {
    const touchCurrentY = e.touches[0].clientY;
    const diff = touchCurrentY - touchStartY;

    // Déclencher seulement si on est EXACTEMENT en haut ET qu'on tire vers le bas
    if (homeContent.scrollTop === 0 && diff > 0 && !isRefreshing) {
        isPulling = true;
        spinner.style.transform = `translateX(-50%) translateY(${Math.min(diff - 50, 50)}px)`;
        spinner.style.opacity = Math.min(diff / 100, 1);
        if (diff > 70) spinner.classList.add('active');
        else spinner.classList.remove('active');
    } else if (diff <= 0 || homeContent.scrollTop > 0) {
        // Si on scrolle vers le bas ou qu'on est pas en haut : reset
        isPulling = false;
        spinner.classList.remove('active');
        spinner.style.transform = `translateX(-50%) translateY(-50px)`;
        spinner.style.opacity = 0;
    }
});

homeContent.addEventListener('touchend', (e) => {
    if (!isPulling) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchEndY - touchStartY;

    if (diff > 70 && !isRefreshing) {
        isRefreshing = true;
        spinner.classList.add('active');

        afficherAnnoncesParGroupes(villeSelectionnee)
            .finally(() => {
                isRefreshing = false;
                spinner.classList.remove('active');
                spinner.style.transform = `translateX(-50%) translateY(-50px)`;
                spinner.style.opacity = 0;
            });
    } else {
        spinner.classList.remove('active');
        spinner.style.transform = `translateX(-50%) translateY(-50px)`;
        spinner.style.opacity = 0;
    }

    touchStartY = 0;
    isPulling = false;
});

/* ===================================================== */
/* ======= SUPPRESSION AUTO ANNONCES EXPIRÉES ========= */
/* ===================================================== */
function verifierAnnoncesExpirees() {
    const now = new Date();

    // Chercher toutes les cartes d'annonces affichées
    document.querySelectorAll(".annonce-card").forEach(card => {
        const expireEl = card.querySelector(".expire-info");
        if (!expireEl) return;

        // Récupérer le texte d'expiration
        const texte = expireEl.textContent;

        // Si le texte indique 0 jour ou négatif, supprimer la carte
        if (texte.includes("expire dans 0") || texte.includes("expire dans -")) {
            card.style.transition = "opacity 0.5s ease";
            card.style.opacity = "0";
            setTimeout(() => {
                card.remove();

                // Si la row est vide, afficher message
                const row = card.closest(".annonces-row");
                if (row && row.children.length === 0) {
                    row.innerHTML = `<p style="text-align:center; font-size:16px; margin-top:20px;">
                        Aucune annonce disponible.
                    </p>`;
                }
            }, 500);
        }
    });
}

// Vérifier toutes les minutes
setInterval(verifierAnnoncesExpirees, 60 * 1000);