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
  if(type === "success" || type === "clipboardSuccess") color = "#4CAF50";   // vert
  else if(type === "error" || type === "loadFail" || type === "clipboardFail") color = "#f44336"; // rouge
  else if(type === "info") color = "#2196F3";      // bleu
  else if(type === "warning") color = "#ffc107";   // jaune/orange
  else color = "#2196F3"; // fallback bleu

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
      borderRadius: "8px", 
      boxShadow: "0 4px 8px rgba(0,0,0,0.2)", 
      fontSize: "15px", 
      color: "#fff"
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
            .then(() => showToast("success")) // message prédéfini succès
            .catch(err => showToast("loadFail")); // message prédéfini échec
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
        showToast("success", "✅ Installation acceptée !");
    } else {
        showToast("info", "Installation annulée par l'utilisateur.");
    }

    deferredPrompt = null;
});

// Détecter PWA installée
window.addEventListener('appinstalled', () => {
    loaderOverlay.style.display = "none"; // s'assure que le spinner est caché
    showToast("success", "✅ ChezMoi est maintenant installé sur votre appareil !");
});

// Bouton Fermer
dismissBtn.addEventListener('click', hidePwaPrompt);

// Affichage automatique toutes les 2 minutes (au lieu de 5)
document.addEventListener('DOMContentLoaded', () => {
    showPwaPrompt();
    setInterval(showPwaPrompt, 2 * 60 * 1000);
});

/* ============================= */
/* INSCRIPTION */
const form = document.getElementById("formInscription");
const loader = document.getElementById("loader");

form.addEventListener("submit", async (e) => {
    e.preventDefault(); // empêche rechargement page

    // Afficher le loader
    loader.classList.add("show");

    const inputs = form.querySelectorAll("input");
    const nom = inputs[0].value;
    const email = inputs[1].value;
    const password = inputs[2].value;
    const inscontact = inputs[3].value;

    try {
        const res = await fetch(`${API_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nom, email, password, inscontact,})
        });

        const data = await res.json();

        // Cacher le loader
        loader.classList.remove("show");

        if (!res.ok) throw new Error(data.message);

        // toast de succès
        showToast("info", "Inscription réussie !");

        currentUserUid = data.uid;
        localStorage.setItem("uid", data.uid);

        try {
            const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
            favorisLocal = await favRes.json();
        } catch(err){
            // toast d'erreur
            showToast("loadFail");
            favorisLocal = [];
        }

        afficherPage("home");

    } catch (err) {
        loader.classList.remove("show");
        // toast d'erreur
        showToast("loadFail");
    }
});

/* ============================= */
/* CONNEXION */
async function loginUser() {
    const form = document.getElementById("formConnexion");
    const inputs = form.querySelectorAll("input");
    const email = inputs[0].value;
    const password = inputs[1].value;

    const loader = document.getElementById("loader-connexion");

    try {
        loader.style.display = "flex"; // Affiche le loader
        const res = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        loader.style.display = "none"; // Masque le loader après réponse

        if (!res.ok) throw new Error(data.message);

        // toast de succès 
        showToast("info", "Connexion réussie !");
        
        currentUserUid = data.uid;
        localStorage.setItem("uid", data.uid);

        // Chargement des favoris de l'utilisateur
        try {
            const favRes = await fetch(`${API_URL}/api/favorites/${currentUserUid}`);
            favorisLocal = await favRes.json();
        } catch (err) {

            // toast d'erreur
            showToast("loadFail");
            
            favorisLocal = [];
        }

        afficherPage("home");
        afficherAnnoncesParGroupes(villeSelectionnee);

    } catch (err) {
        loader.style.display = "none"; // Masque le loader en cas d'erreur
        
        // toast d'erreur plus visible que alert()
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

/* ===================================================== */
/* ================= GRILLE D'IMAGES ================== */
/* ===================================================== */

const imageGrid = document.getElementById("imageGrid");
const hiddenInput = document.getElementById("hiddenImageInput");
const imageCounter = document.getElementById("imageCounter");

let selectedFiles = [];

// Met à jour le compteur
function updateImageCounter() {
    if(imageCounter){
        imageCounter.textContent = `Images : ${selectedFiles.length}/5`;
    }
}

// Met à jour la grille
function renderGrid() {
    imageGrid.innerHTML = "";

    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const card = document.createElement("div");
            card.classList.add("image-card");

            const img = document.createElement("img");
            img.src = e.target.result;
            card.appendChild(img);

            // plein écran au clic
            img.addEventListener("click", () => afficherPleinEcran(e.target.result));

            // bouton supprimer
            const btnSuppr = document.createElement("div");
            btnSuppr.classList.add("btnSuppr");
            btnSuppr.textContent = "✖";
            btnSuppr.title = "Supprimer";
            btnSuppr.addEventListener("click", (ev) => {
                ev.stopPropagation(); // empêche le plein écran
                selectedFiles.splice(index, 1);
                renderGrid();
                updateImageCounter();
            });

            card.appendChild(btnSuppr);
            imageGrid.appendChild(card);
        };
        reader.readAsDataURL(file);
    });

    // Card "+" pour ajouter des images
    if(selectedFiles.length < 5){
        const plusCard = document.createElement("div");
        plusCard.classList.add("image-card", "plus");
        plusCard.textContent = "+";
        plusCard.addEventListener("click", () => hiddenInput.click());
        imageGrid.appendChild(plusCard);
    }

    updateImageCounter();
}

// Sélection de nouvelles images
hiddenInput.addEventListener("change", () => {
    const files = Array.from(hiddenInput.files);

    if(selectedFiles.length + files.length > 5){
        alert("Maximum 5 images autorisées.");
        hiddenInput.value = "";
        return;
    }

    selectedFiles = selectedFiles.concat(files);
    renderGrid();
    hiddenInput.value = "";
});

/* ===================================================== */
/* ================= PLEIN ÉCRAN ====================== */
/* ===================================================== */
function afficherPleinEcran(src) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.9)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = 9999;
    overlay.style.cursor = "pointer";

    const img = document.createElement("img");
    img.src = src;
    img.style.maxWidth = "90%";
    img.style.maxHeight = "90%";
    img.style.borderRadius = "8px";

    overlay.appendChild(img);

    overlay.addEventListener("click", () => overlay.remove());

    document.body.appendChild(overlay);
}

/* ===================================================== */
/* ================= PUBLIER ANNONCE =================== */
/* ===================================================== */
const formAjouter = document.getElementById("formAjouter");
const chargementpub = document.getElementById("loader-pub")

if(formAjouter){
    formAjouter.addEventListener("submit", async (e) => {
        e.preventDefault();

        if(!currentUserUid){
            // toast d'information
            showToast("info", "Vous devez être connecté pour voir vos favoris.");
            afficherPage("inscription")
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

        if(!titre || !type || !ville || !quartier || !douche || !prix || !description || !contact){
            // toast d'information
            showToast("formIncomplete");
            return;
        }

        if(selectedFiles.length === 0){
            // toast d'information
            showToast("info", "Veuillez sélectionner au moins une image.");
            return;
        }

        // loader
        chargementpub.style.display = "flex"

        try{
            const imagesBase64 = [];
            for(let file of selectedFiles){
                const base64 = await convertirEnBase64(file);
                imagesBase64.push(base64);
            }

            const now = new Date();
            const expiration = new Date();
            expiration.setMonth(expiration.getMonth() + 1);

            const bodyData = {
                uid: currentUserUid,
                titre,
                type_annonce: type,
                description,
                prix: Number(prix),
                ville,
                quartier,
                douche,
                contact,
                imagesBase64,
                dateCreation: now.toISOString(),
                dateExpiration: expiration.toISOString()
            };

            const response = await fetch(`${API_URL}/api/annonces`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(bodyData)
            });

            // Lire le body **une seule fois** et parser
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                chargementpub.style.display = "none"
                console.error("Réponse serveur non JSON :", text);
                // toast d'erreur
                showToast("serverDown");
                return;
            }

            if(!response.ok){
                console.error("Erreur serveur :", data);
                chargementpub.style.display = "none"
                // toast d'erreur
                showToast("serverDown");
                return;
            }

            // arret du loader
            chargementpub.style.display = "none"
            // toast de succès
            showToast("info", "Annonce publiée !");
            formAjouter.reset();
            selectedFiles = [];
            renderGrid();
            afficherPage("home");
            afficherAnnoncesParGroupes("Toutes les villes");

        } catch(error){
            console.error("Erreur JS :", error);
            chargementpub.style.display = "none"
            // toast d'erreur
            showToast("loadFail");
        }
    });
}

/* ===================================================== */
/* ================= CONVERTIR BASE64 ================== */
/* ===================================================== */
function convertirEnBase64(file){
    return new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Initialisation de la grille au chargement
renderGrid();

/* ===================================================== */
/* ================= AFFICHAGE DÉTAIL ================= */
/* ===================================================== */
function afficherDetailAnnonce() {
    // Récupérer l'annonce sélectionnée depuis localStorage
    const data = localStorage.getItem("annonceDetail");
    if (!data) return; // si aucune annonce n'est stockée, ne rien faire

    const annonce = JSON.parse(data);

    // calculer jours restants
    const joursRestants = getJoursRestants(annonce.expireAt)

    const expirationEl = document.getElementById("detailexpiration");

    if (joursRestants <= 0) {
        expirationEl.textContent = "Annonce expirée";
        expirationEl.style.color = "red";
        expirationEl.style.display = "inline"; // visible
    }
    else if (joursRestants <= 2) {
        expirationEl.textContent = "⚠️ Expire dans " + joursRestants + " jours";
        expirationEl.style.color = "red";
        expirationEl.style.display = "inline"; // visible
    }
    else if (joursRestants <= 7) {
        expirationEl.textContent = "Expire dans " + joursRestants + " jours";
        expirationEl.style.color = "orange";
        expirationEl.style.display = "inline"; // visible
    }
    else {
        expirationEl.style.display = "none"; // cache si plus de 7 jours
    }

    // Remplir les champs de la page détail
    document.getElementById("detailTitre").textContent = annonce.titre || "";
    document.getElementById("detaillogement").textContent = annonce.type_annonce || "";
    document.getElementById("detailDescription").textContent = annonce.description || "";
    document.getElementById("detailVille").textContent = annonce.ville || "";
    document.getElementById("detailQuartier").textContent = annonce.quartier || "";
    document.getElementById("detailDouche").textContent = annonce.douche || "";
    document.getElementById("detailPrix").textContent = annonce.prix || "";
    document.getElementById("detailContact").textContent = annonce.contact || "";

    // Afficher les images
    const imagesContainer = document.getElementById("detailImages");
    imagesContainer.innerHTML = ""; // vider avant d'ajouter

    const images = (annonce.images && annonce.images.length > 0) ? annonce.images : ["image/logo_ChezMoi.png"];

    images.forEach(img => {
        const imageEl = document.createElement("img");
        imageEl.src = img;
        imageEl.alt = annonce.titre;
        imageEl.style.maxWidth = "200px";
        imageEl.style.marginRight = "10px";
        imageEl.style.cursor = "pointer"; // montrer que c'est cliquable
        imagesContainer.appendChild(imageEl);

        // ======= Activer plein écran au clic =======
        imageEl.addEventListener("click", () => {
            // Créer l'overlay si pas déjà présent
            let overlay = document.getElementById("imageFullscreenOverlay");
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.id = "imageFullscreenOverlay";
                overlay.style.position = "fixed";
                overlay.style.top = 0;
                overlay.style.left = 0;
                overlay.style.width = "100%";
                overlay.style.height = "100%";
                overlay.style.backgroundColor = "rgba(0,0,0,0.9)";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.zIndex = 9999;
                overlay.style.cursor = "pointer";

                const fullscreenImg = document.createElement("img");
                fullscreenImg.id = "fullscreenImg";
                fullscreenImg.style.maxWidth = "90%";
                fullscreenImg.style.maxHeight = "90%";
                overlay.appendChild(fullscreenImg);

                document.body.appendChild(overlay);

                // Fermer au clic sur l'overlay
                overlay.addEventListener("click", () => {
                    overlay.style.display = "none";
                });

                // Fermer avec Échap
                document.addEventListener("keydown", (e) => {
                    if(e.key === "Escape"){
                        overlay.style.display = "none";
                    }
                });
            }

            document.getElementById("fullscreenImg").src = img;
            overlay.style.display = "flex";
        });
    });
    // Bouton Je le veux → ouvrir paiement
    const btnDebloquer = document.getElementById("btnDebloquerContact");

    if(btnDebloquer){
        btnDebloquer.addEventListener("click", () => {
            afficherPage("paiementDeblocage");
        });
    }
}

/* ============================= */
/* IMAGE PLEIN ÉCRAN POUR LA PAGE DETAIL ANNONCES    */
/* ============================= */
function activerFullscreenImages() {
    const images = document.querySelectorAll("#detailImages img");

    images.forEach(img => {
        img.style.cursor = "pointer"; // montrer que c'est cliquable

        img.addEventListener("click", () => {
            // Créer l'overlay si pas déjà présent
            let overlay = document.getElementById("imageFullscreenOverlay");
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.id = "imageFullscreenOverlay";
                overlay.style.position = "fixed";
                overlay.style.top = 0;
                overlay.style.left = 0;
                overlay.style.width = "100%";
                overlay.style.height = "100%";
                overlay.style.backgroundColor = "rgba(0,0,0,0.9)";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.zIndex = 9999;
                overlay.style.cursor = "pointer";

                const fullscreenImg = document.createElement("img");
                fullscreenImg.id = "fullscreenImg";
                fullscreenImg.style.maxWidth = "90%";
                fullscreenImg.style.maxHeight = "90%";
                overlay.appendChild(fullscreenImg);

                document.body.appendChild(overlay);

                // Fermer au clic sur l'overlay
                overlay.addEventListener("click", () => {
                    overlay.style.display = "none";
                });

                // Fermer avec la touche Échap
                document.addEventListener("keydown", (e) => {
                    if(e.key === "Escape"){
                        overlay.style.display = "none";
                    }
                });
            }

            // Mettre l'image cliquée dans l'overlay et l'afficher
            document.getElementById("fullscreenImg").src = img.src;
            overlay.style.display = "flex";
        });
    });
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
    let pageId = (event.state && event.state.page) ? event.state.page : 'home';

    // Si l’historique essaye de revenir sur "accueil", on force "home"
    if(pageId === 'accueil') pageId = 'home';

    // Empêche pushState lors du retour en arrière
    afficherPage.skipHistory = true;
    afficherPage(pageId);
    afficherPage.skipHistory = false;
});