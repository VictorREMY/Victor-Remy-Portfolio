/* Corrige un piège classique des navigateurs : en cliquant "retour", certains
   navigateurs restaurent une version figée de la page (telle qu'elle était
   au moment de la quitter, donc parfois en plein milieu d'une animation)
   plutôt que de la recharger proprement. On force un rechargement frais. */
window.addEventListener("pageshow", function(e){
  if(e.persisted){
    window.location.reload();
  }
});

/* ==========================================================
   FONCTIONS PARTAGÉES — utilisées par toutes les pages
   ========================================================== */

/* Les projets sont chargés depuis data/projects.json
   (modifiable via le CMS), pas codés en dur ici. */
let PROJECTS = [];

function loadProjectsData(){
  return fetch("data/projects.json")
    .then(response => response.json())
    .then(data => { PROJECTS = data.projects; return PROJECTS; })
    .catch(err => {
      console.error("Impossible de charger les projets :", err);
      return [];
    });
}

/* Positions de bulles ajustées manuellement (mode édition), par page.
   Format : { "hub.html": { "musique": {x,y}, ... }, "musique.html": {...} } */
let LAYOUT = {};

function loadLayoutData(){
  return fetch("data/layout.json")
    .then(response => response.json())
    .then(data => { LAYOUT = data || {}; return LAYOUT; })
    .catch(() => { LAYOUT = {}; return LAYOUT; });
}

/* Dispositions personnalisées du CONTENU d'un chapitre (blocs texte/image/
   vidéo positionnés librement). Format :
   { "id-du-projet": { "id-du-chapitre": { canvasWidth, canvasHeight, blocks:[...] } } } */
let CHAPTER_LAYOUTS = {};

function loadChapterLayouts(){
  return fetch("data/chapter-layouts.json")
    .then(response => response.json())
    .then(data => { CHAPTER_LAYOUTS = data || {}; return CHAPTER_LAYOUTS; })
    .catch(() => { CHAPTER_LAYOUTS = {}; return CHAPTER_LAYOUTS; });
}

function currentPageKey(){
  return window.location.pathname.split("/").pop() || "index.html";
}

/* Retourne la position enregistrée pour cette bulle sur cette page :
   en priorité celle en cours d'édition dans cette session (si tu es en
   train de retravailler plusieurs pages sans avoir encore copié/collé),
   sinon celle déjà sauvegardée dans data/layout.json, sinon la position
   calculée automatiquement. */
function resolvePosition(key, autoX, autoY){
  const page = currentPageKey();
  if(isEditMode()){
    const session = getEditSession();
    if(session[page] && session[page][key]) return { x: session[page][key].x, y: session[page][key].y };
  }
  const saved = LAYOUT[page];
  if(saved && saved[key]) return { x: saved[key].x, y: saved[key].y };
  return { x: autoX, y: autoY };
}

/* Brouillon d'édition en cours, gardé le temps de la session de navigation
   (permet de modifier plusieurs pages avant de tout copier d'un coup). */
function getEditSession(){
  try { return JSON.parse(sessionStorage.getItem("editSession") || "{}"); }
  catch(e){ return {}; }
}

function saveEditSessionForCurrentPage(){
  const session = getEditSession();
  const page = currentPageKey();
  const overrides = session[page] || {};
  document.querySelectorAll("[data-key]").forEach(el => {
    overrides[el.dataset.key] = {
      x: Math.round(parseFloat(el.style.left) * 10) / 10,
      y: Math.round(parseFloat(el.style.top) * 10) / 10
    };
  });
  session[page] = overrides;
  sessionStorage.setItem("editSession", JSON.stringify(session));
}

/* ==========================================================
   NAVIGATION PAR SYPHONS (remplace la nav texte + grilles)
   ========================================================== */

/* ---------- Transition "zoom" : un cercle qui part du point cliqué
   pour recouvrir l'écran, puis se rétracte au chargement de la page
   suivante depuis ce même point (mémorisé via sessionStorage).
   Utilise directement l'API d'animation du navigateur pour plus de fiabilité. ---------- */
let _zoomOverlay = null;

function maxRadius(){
  return Math.hypot(window.innerWidth, window.innerHeight);
}

function initZoomTransitions(){
  _zoomOverlay = document.createElement("div");
  _zoomOverlay.className = "zoom-overlay";
  document.body.appendChild(_zoomOverlay);

  let origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const stored = sessionStorage.getItem("zoomOrigin");
  if(stored){
    origin = JSON.parse(stored);
    sessionStorage.removeItem("zoomOrigin");
  }

  const r = maxRadius();
  _zoomOverlay.style.clipPath = `circle(${r}px at ${origin.x}px ${origin.y}px)`;
  _zoomOverlay.classList.add("active");

  const anim = _zoomOverlay.animate(
    [
      { clipPath: `circle(${r}px at ${origin.x}px ${origin.y}px)` },
      { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }
    ],
    { duration: 800, easing: "cubic-bezier(0.76,0,0.24,1)", fill: "forwards" }
  );
  anim.onfinish = () => {
    _zoomOverlay.classList.remove("active");
  };
}

/* Zoome depuis un point (x,y) donné vers une page cible */
function zoomToPage(x, y, targetUrl){
  sessionStorage.setItem("zoomOrigin", JSON.stringify({ x, y }));
  zoomThenRun(x, y, () => { window.location.href = targetUrl; });
}

/* Même animation, mais exécute une fonction plutôt que de changer d'URL */
function zoomThenRun(x, y, callback){
  const r = maxRadius();
  _zoomOverlay.classList.add("active");
  const anim = _zoomOverlay.animate(
    [
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      { clipPath: `circle(${r}px at ${x}px ${y}px)` }
    ],
    { duration: 700, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" }
  );
  anim.onfinish = callback;
}

/* Effet "tourbillon" : le syphon cliqué grossit et tourne sur lui-même,
   comme aspiré dans l'écran — donne un retour visuel immédiat et fort. */
function vortexInto(syphonEl, targetUrl){
  const rect = syphonEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  syphonEl.style.zIndex = "500";
  syphonEl.animate(
    [
      { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", opacity: 1 },
      { transform: "translate(-50%, -50%) scale(22) rotate(240deg)", opacity: 0 }
    ],
    { duration: 700, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" }
  );

  zoomToPage(x, y, targetUrl);
}

/* ---------- Génère et affiche les syphons dans un conteneur ----------
   items: [{ label, sublabel, href }] — usage simple, un seul niveau.
   Utilise le même motif que les niveaux imbriqués : 1 bulle = centrée,
   2 = côte à côte, 3 = deux coins + un centre. */
function renderSyphons(containerId, items){
  const field = document.getElementById(containerId);
  field.innerHTML = "";
  const n = items.length;
  const radius = n === 1 ? 0 : 24;
  const autoPositions = positionsAround(50, 50, n, radius, -Math.PI / 2);

  items.forEach((item, i) => {
    const pos = resolvePosition(item.key, autoPositions[i].x, autoPositions[i].y);
    const el = document.createElement("a");
    el.href = item.href;
    el.className = "syphon";
    el.setAttribute("data-syphon", "true");
    el.setAttribute("data-key", item.key);
    if(item.popup) el.setAttribute("data-popup", "true");
    if(item.contextTag) el.setAttribute("data-context", item.contextTag);
    el.style.left = pos.x + "%";
    el.style.top = pos.y + "%";
    if(item.thumbnail){
      el.classList.add("has-thumb");
      el.style.backgroundImage = `linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.05) 60%), url('${item.thumbnail}')`;
    }
    el.innerHTML = `<span>${item.label}</span><span class="zoom-hint">${item.sublabel || "zoom in !"}</span>`;
    field.appendChild(el);
  });
  bindSyphonClicks(field);
}

/* Motifs de placement selon le nombre de bulles à répartir autour d'un
   centre. Coordonnées locales : y = éloignement du centre (direction
   "vers l'extérieur"), x = décalage perpendiculaire (gauche/droite).
   1 = centrée ; 2 = côte à côte ; 3 = deux coins éloignés + un centre. */
const CHILD_PATTERNS = {
  1: [{ x: 0, y: 1.0 }],
  2: [{ x: -0.95, y: 0.85 }, { x: 0.95, y: 0.85 }],
  3: [{ x: -0.95, y: 1.0 }, { x: 0.95, y: 1.0 }, { x: 0, y: 0.6 }]
};

/* Calcule n positions (en %) autour d'un centre donné, orientées vers "outward" */
function positionsAround(centerX, centerY, n, radius, outward){
  const pattern = CHILD_PATTERNS[n] || Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1 || 1)) - 0.5;
    return { x: Math.sin(t * Math.PI * 0.6), y: 1 };
  });
  return pattern.map(local => {
    const dx = local.x * -Math.sin(outward) + local.y * Math.cos(outward);
    const dy = local.x * Math.cos(outward) + local.y * Math.sin(outward);
    return {
      x: clampPct(centerX + dx * radius),
      y: clampPct(centerY + dy * radius * 0.85)
    };
  });
}

/* ---------- Rendu hiérarchique imbriqué ----------
   nodes: [{ label, href, children: [...même forme...] }]
   Chaque niveau de profondeur réduit la taille du syphon et le
   regroupe visuellement autour de son parent, relié par une ligne.
   Permet de zoomer directement vers une sous-catégorie ou un projet
   sans passer par toutes les pages intermédiaires. */
function renderSyphonTree(containerId, nodes){
  const field = document.getElementById(containerId);
  field.innerHTML = "";
  const pairs = []; // { parentEl, childEl } — les lignes sont tracées après coup, en pixels réels

  const n = nodes.length;
  const rootRadius = n === 1 ? 0 : 22;
  const rootPositions = positionsAround(50, 50, n, rootRadius, -Math.PI / 2);

  nodes.forEach((node, i) => {
    renderSyphonNode(field, node, rootPositions[i].x, rootPositions[i].y, 0, null, pairs);
  });

  bindSyphonClicks(field);
  drawConnectors(field, pairs);
}

function renderSyphonNode(field, node, autoX, autoY, depth, incomingAngle, pairs){
  const pos = resolvePosition(node.key, autoX, autoY);
  const xPct = pos.x, yPct = pos.y;

  const sizeClass = depth === 0 ? "" : depth === 1 ? "syphon-sm" : "syphon-xs";
  const el = document.createElement("a");
  el.href = node.href;
  el.className = ("syphon " + sizeClass).trim();
  el.setAttribute("data-syphon", "true");
  el.setAttribute("data-key", node.key);
  el.style.left = xPct + "%";
  el.style.top = yPct + "%";
  el.innerHTML = `<span>${node.label}</span><span class="zoom-hint">zoom in !</span>`;
  field.appendChild(el);

  // On limite à 2 niveaux d'imbrication (branches > sous-catégories > projets)
  if(node.children && node.children.length && depth < 2){
    const outward = incomingAngle !== null && incomingAngle !== undefined
      ? incomingAngle
      : Math.atan2(yPct - 50, xPct - 50);
    const radius = depth === 0 ? 14 : 9;
    const childAutoPositions = positionsAround(xPct, yPct, node.children.length, radius, outward);

    node.children.forEach((child, i) => {
      const childEl = renderSyphonNode(field, child, childAutoPositions[i].x, childAutoPositions[i].y, depth + 1, outward, pairs);
      pairs.push({ parentEl: el, childEl });
    });
  }

  return el;
}

/* Trace les lignes de connexion en pixels réels, une fois que tous les
   syphons sont dans le DOM — évite tout décalage entre systèmes de coordonnées. */
function drawConnectors(field, pairs){
  pairs.forEach(({ parentEl, childEl }) => {
    const r1 = parentEl.getBoundingClientRect();
    const r2 = childEl.getBoundingClientRect();
    const x1 = r1.left + r1.width / 2, y1 = r1.top + r1.height / 2;
    const x2 = r2.left + r2.width / 2, y2 = r2.top + r2.height / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    const line = document.createElement("div");
    line.className = "connector-line";
    line.style.left = x1 + "px";
    line.style.top = y1 + "px";
    line.style.width = length + "px";
    line.style.transform = `rotate(${angle}deg)`;
    field.appendChild(line);
  });
}

function clampPct(v){
  return Math.min(88, Math.max(12, v));
}

function isEditMode(){
  return new URLSearchParams(window.location.search).get("edit") === "1";
}

function bindSyphonClicks(field){
  if(isEditMode()) return; // en édition, le clic sert à glisser, pas à naviguer
  field.querySelectorAll("[data-syphon]").forEach(el => {
    el.addEventListener("click", function(e){
      e.preventDefault();
      if(this.dataset.popup === "true"){
        openProjectPopup(this.dataset.key, this.dataset.context || null);
      } else {
        vortexInto(this, this.getAttribute("href"));
      }
    });
  });
}

/* ==========================================================
   MODE ÉDITION — déplacer les bulles à la souris
   Activé en ajoutant ?edit=1 à l'adresse de la page. Pas de
   lien visible nulle part : c'est un mode pour toi, pas pour
   tes visiteurs. Les positions se sauvegardent en cliquant
   "Copier les positions", à coller dans data/layout.json puis
   à envoyer sur GitHub comme le reste du contenu.
   ========================================================== */
function initEditMode(){
  if(!isEditMode()) return;

  document.body.classList.add("edit-mode");

  let dragEl = null, offsetX = 0, offsetY = 0;

  document.addEventListener("pointerdown", function(e){
    const syphon = e.target.closest(".syphon");
    if(!syphon) return;
    e.preventDefault();
    dragEl = syphon;
    dragEl.classList.add("dragging");
    const rect = syphon.getBoundingClientRect();
    offsetX = e.clientX - (rect.left + rect.width / 2);
    offsetY = e.clientY - (rect.top + rect.height / 2);
  });

  document.addEventListener("pointermove", function(e){
    if(!dragEl) return;
    const xPct = ((e.clientX - offsetX) / window.innerWidth) * 100;
    const yPct = ((e.clientY - offsetY) / window.innerHeight) * 100;
    dragEl.style.left = clampPct(xPct) + "%";
    dragEl.style.top = clampPct(yPct) + "%";
  });

  document.addEventListener("pointerup", function(){
    dragEl = dragEl && dragEl.classList.remove("dragging");
    dragEl = null;
  });

  // En mode édition, un clic sur une bulle ne doit jamais naviguer
  document.addEventListener("click", function(e){
    if(e.target.closest(".syphon")) e.preventDefault();
  }, true);

  buildEditPanel();
}

const EDITABLE_PAGES = [
  { v: "hub.html", l: "Hub" },
  { v: "musique.html", l: "Musique" },
  { v: "musique-son.html", l: "Musique / Chansons produites" },
  { v: "musique-projet.html", l: "Musique / Projets produits" },
  { v: "video.html", l: "Vidéo" },
  { v: "video-montage.html", l: "Vidéo / Montage" },
  { v: "video-realisation.html", l: "Vidéo / Réalisation" },
  { v: "vfx.html", l: "VFX" },
  { v: "vfx-generatif.html", l: "VFX / Génératif" },
  { v: "vfx-interactif.html", l: "VFX / Interactif" },
  { v: "vfx-video.html", l: "VFX / Basé sur vidéo" }
];

function buildEditPanel(){
  const current = currentPageKey();
  const options = EDITABLE_PAGES.map(p =>
    `<option value="${p.v}" ${p.v === current ? "selected" : ""}>${p.l}</option>`
  ).join("");

  const panel = document.createElement("div");
  panel.className = "edit-panel";
  panel.innerHTML = `
    <p><strong>Mode édition</strong> — glisse les bulles.</p>
    <select id="edit-page-switch" class="pill-link">${options}</select>
    <button id="edit-copy" class="pill-link">Copier toutes les pages modifiées</button>
    <a href="${window.location.pathname}" class="pill-link">Quitter sans sauvegarder</a>
  `;
  document.body.appendChild(panel);

  // Changer de page en édition : on garde en mémoire ce qui vient d'être fait ici
  document.getElementById("edit-page-switch").addEventListener("change", function(){
    saveEditSessionForCurrentPage();
    window.location.href = this.value + "?edit=1";
  });

  document.getElementById("edit-copy").addEventListener("click", function(){
    saveEditSessionForCurrentPage();
    const session = getEditSession();
    const merged = JSON.parse(JSON.stringify(LAYOUT)); // copie du fichier tel qu'il était déjà
    Object.keys(session).forEach(page => {
      merged[page] = Object.assign({}, merged[page] || {}, session[page]);
    });
    const json = JSON.stringify(merged, null, 2);

    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(json).then(() => {
        alert("Copié ! Ça inclut toutes les pages modifiées pendant cette session. Colle ce contenu dans data/layout.json, puis envoie ce fichier sur GitHub.");
      }).catch(() => showLayoutFallback(json));
    } else {
      showLayoutFallback(json);
    }
  });
}

function showLayoutFallback(json){
  prompt("Copie ce texte (Ctrl+C / Cmd+C), colle-le dans data/layout.json :", json);
}

/* ---------- Bouton retour (utilise l'historique du navigateur, avec la transition zoom depuis le bas gauche) ---------- */
function bindRetourButton(){
  const btn = document.querySelector("[data-retour]");
  if(!btn) return;
  btn.addEventListener("click", function(e){
    e.preventDefault();
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    zoomThenRun(x, y, () => window.history.back());
  });
}

/* ==========================================================
   ZOOM CONTINU À LA MOLETTE
   - Scroller vers l'avant sur un syphon zoome dessus ; passé un
     certain niveau, la navigation se déclenche automatiquement.
   - Scroller vers l'arrière (hors d'un syphon en cours de zoom)
     dézoome toute la page ; passé un certain niveau, ça déclenche
     le retour — l'inverse exact du zoom avant.
   - Le clic reste un raccourci optionnel (voir vortexInto).
   ========================================================== */
function initWheelZoom(){
  if(new URLSearchParams(window.location.search).get("edit") === "1") return;
  const stage = document.getElementById("zoom-stage");
  if(!stage) return;

  const MAX_SCALE = 6;       // niveau de zoom avant max
  const THRESHOLD_IN = 4;    // seuil pour déclencher l'entrée dans le syphon
  const MIN_SCALE = 0.12;    // niveau de dézoom max
  const THRESHOLD_OUT = 0.3; // seuil pour déclencher le retour (plus bas = plus de marge avant que ça bascule)

  let scale = 1;
  let target = null;
  let resetTimer = null;
  let navigating = false;
  const retourBtn = document.querySelector("[data-retour]");

  function applyStage(immediate, origin){
    stage.style.transition = immediate ? "none" : "transform 0.5s cubic-bezier(0.22,1,0.36,1)";
    if(origin) stage.style.transformOrigin = origin;
    stage.style.transform = `scale(${scale})`;
  }

  function resetStage(){
    scale = 1;
    target = null;
    applyStage(false, "50% 50%");
  }

  /* Trouve le syphon le plus proche du curseur, peu importe si la souris
     est pile dessus ou juste quelque part sur la page — permet de zoomer
     "dans l'espace" depuis n'importe où, pas seulement en survolant une bulle. */
  function findNearestSyphon(x, y){
    let nearest = null, minDist = Infinity;
    document.querySelectorAll(".syphon").forEach(el => {
      const rect = el.getBoundingClientRect();
      const dist = Math.hypot((rect.left + rect.width / 2) - x, (rect.top + rect.height / 2) - y);
      if(dist < minDist){ minDist = dist; nearest = el; }
    });
    return nearest;
  }

  window.addEventListener("wheel", function(e){
    if(navigating) return;
    e.preventDefault();

    const zoomingIn = e.deltaY < 0;

    if(zoomingIn){
      // ---------- Zoom avant : cible la bulle la plus proche, où que soit la souris ----------
      if(!target){
        const nearest = findNearestSyphon(e.clientX, e.clientY);
        if(!nearest) return;
        target = nearest;
        const rect = target.getBoundingClientRect();
        stage.style.transformOrigin = `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`;
      }

      scale = Math.min(MAX_SCALE, scale + (-e.deltaY * 0.004));
      applyStage(true);
      clearTimeout(resetTimer);

      if(scale >= THRESHOLD_IN){
        navigating = true;
        vortexInto(target, target.getAttribute("href"));
        return;
      }
      resetTimer = setTimeout(resetStage, 450);

    } else {
      // ---------- Zoom arrière : dézoome toute la page, déclenche "retour" ----------
      if(target) return; // on ne dézoome pas tant qu'on est en train d'entrer dans un syphon

      if(!retourBtn) return; // rien où retourner (ex: page d'accueil)

      stage.style.transformOrigin = "50% 50%";
      scale = Math.max(MIN_SCALE, scale + (-e.deltaY * 0.004));
      applyStage(true);
      clearTimeout(resetTimer);

      if(scale <= THRESHOLD_OUT){
        navigating = true;
        zoomOutBack();
        return;
      }
      resetTimer = setTimeout(resetStage, 450);
    }
  }, { passive: false });
}

/* Animation de dézoom qui déclenche le retour (l'inverse de vortexInto) */
function zoomOutBack(){
  const stage = document.getElementById("zoom-stage");
  stage.style.transition = "transform 0.45s cubic-bezier(0.6,0,0.9,0.4)";
  stage.style.transformOrigin = "50% 50%";
  stage.style.transform = "scale(0.08)";

  _zoomOverlay.classList.add("active");
  const r = maxRadius();
  const anim = _zoomOverlay.animate(
    [
      { clipPath: "circle(0px at 50% 50%)" },
      { clipPath: `circle(${r}px at 50% 50%)` }
    ],
    { duration: 450, easing: "cubic-bezier(0.6,0,0.9,0.4)", fill: "forwards" }
  );
  anim.onfinish = () => window.history.back();
}

/* ==========================================================
   BULLES CONTACT / À PROPOS
   Superposées à la page en cours (pas de navigation, pas
   d'historique). Contact à gauche, À propos à droite.
   Cliquer sur l'une ferme l'autre. Cliquer en dehors ferme tout.
   ========================================================== */
function initInfoBubbles(){
  const backdrop = document.createElement("div");
  backdrop.className = "info-backdrop";
  document.body.appendChild(backdrop);

  const contactBubble = document.createElement("div");
  contactBubble.className = "info-bubble left";
  contactBubble.innerHTML = `
    <p class="eyebrow">Contact</p>
    <h2 style="margin:1rem 0 1.5rem;">Discutons d'un <em>projet</em>.</h2>
    <p class="muted" style="margin-bottom:1.5rem; line-height:1.6;">Remplace ce texte par tes vraies coordonnées : email, réseaux, ou un lien de prise de rendez-vous.</p>
    <p style="margin-bottom:0.6rem;">Email — email@exemple.com</p>
    <p style="margin-bottom:0.6rem;">Instagram — @tonpseudo</p>
    <p>Vimeo / YouTube — lien</p>
    <p class="close-hint">Clique en dehors pour fermer</p>
  `;
  document.body.appendChild(contactBubble);

  const aproposBubble = document.createElement("div");
  aproposBubble.className = "info-bubble right";
  aproposBubble.innerHTML = `
    <p class="eyebrow">À propos</p>
    <h2 style="margin:1rem 0 1.5rem;">Musique, image, <em>génératif</em>.</h2>
    <p class="muted" style="line-height:1.7;">Remplace ce texte par ta vraie bio : ton parcours, ta démarche, ce qui relie tes trois disciplines entre elles.</p>
    <p class="close-hint">Clique en dehors pour fermer</p>
  `;
  document.body.appendChild(aproposBubble);

  function closeAll(){
    contactBubble.classList.remove("open");
    aproposBubble.classList.remove("open");
    backdrop.classList.remove("visible");
  }

  document.querySelectorAll("[data-modal]").forEach(link => {
    link.addEventListener("click", function(e){
      e.preventDefault();
      const target = this.dataset.modal === "contact" ? contactBubble : aproposBubble;
      const wasOpen = target.classList.contains("open");
      closeAll();
      if(!wasOpen){
        target.classList.add("open");
        backdrop.classList.add("visible");
      }
    });
  });

  backdrop.addEventListener("click", closeAll);
}

/* ---------- Transition "rideau" entre les pages ----------
   initPageTransitions() : à appeler UNE SEULE FOIS par page (crée le rideau).
   bindTransitionLinks() : à appeler à chaque fois que de nouveaux liens
   sont ajoutés dynamiquement (ex: après avoir généré une grille de projets). */
let _overlay = null;

function initPageTransitions(){
  _overlay = document.createElement("div");
  _overlay.className = "transition-overlay";
  document.body.appendChild(_overlay);

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => _overlay.classList.add("reveal"));
  });

  bindTransitionLinks();
}

function bindTransitionLinks(){
  document.querySelectorAll("a[data-transition]").forEach(link => {
    if(link.dataset.bound) return; // évite d'attacher le même lien deux fois
    link.dataset.bound = "true";
    link.addEventListener("click", function(e){
      e.preventDefault();
      const target = this.getAttribute("href");
      _overlay.classList.remove("reveal");
      _overlay.classList.add("cover");
      setTimeout(() => { window.location.href = target; }, 700);
    });
  });
}

/* ---------- Bouton "Retour" : revient à la page précédente
   (celle d'où le visiteur vient réellement, filtre compris),
   contrairement au fil d'Ariane qui ramène toujours à la racine. ---------- */
function bindBackButtons(){
  document.querySelectorAll("[data-back]").forEach(btn => {
    if(btn.dataset.bound) return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", function(e){
      e.preventDefault();
      _overlay.classList.remove("reveal");
      _overlay.classList.add("cover");
      setTimeout(() => { window.history.back(); }, 700);
    });
  });
}

/* Un projet à chapitres n'a pas de "tags" fixes : ses tags sont l'union
   de ceux de tous ses chapitres. Un projet simple garde son tableau tags. */
function projectTags(project){
  if(Array.isArray(project.chapters) && project.chapters.length){
    const set = new Set();
    project.chapters.forEach(c => (c.tags || []).forEach(t => set.add(t)));
    return Array.from(set);
  }
  return project.tags || [];
}

/* ---------- Récupère les projets qui ont un tag donné ---------- */
function getProjectsByTag(tag){
  if(!tag || tag === "all") return PROJECTS;
  return PROJECTS.filter(p => projectTags(p).includes(tag));
}

/* ---------- Construit une carte projet (HTML) ---------- */
function renderProjectCard(project){
  const tagLabels = project.tags
    .map(t => BRANCHES[t] ? BRANCHES[t].label : t)
    .join(" · ");

  return `
    <a href="projet.html?id=${project.id}" class="project-card" data-transition>
      <div class="thumb">${project.media.type === "pending" ? "média à venir" : project.media.type}</div>
      <h3>${project.title}</h3>
      <p class="muted" style="font-size:0.85rem;">${project.year}${project.role ? " — " + project.role : ""}</p>
      <div class="tags">
        ${project.tags.map(t => `<span class="tag">${BRANCHES[t] ? BRANCHES[t].label : t}</span>`).join("")}
      </div>
    </a>
  `;
}

/* ---------- Affiche une grille filtrable dans un conteneur ---------- */
function renderFilterableGrid(containerId, filterRowId, tagsToShow, defaultTag){
  const grid = document.getElementById(containerId);
  const filterRow = document.getElementById(filterRowId);

  function draw(activeTag){
    grid.innerHTML = getProjectsByTag(activeTag).map(renderProjectCard).join("");
    // Ré-attache les transitions sur les nouvelles cartes générées
    bindTransitionLinks();
  }

  // Génère les boutons de filtre
  const chips = [{ key: "all", label: "Tout" }, ...tagsToShow.map(t => ({ key: t, label: BRANCHES[t].label }))];
  filterRow.innerHTML = chips.map(c =>
    `<button class="filter-chip${c.key === defaultTag ? ' active' : ''}" data-tag="${c.key}">${c.label}</button>`
  ).join("");

  filterRow.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      filterRow.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      draw(btn.dataset.tag);
    });
  });

  draw(defaultTag || "all");
}

/* ---------- Affiche le détail d'un projet à partir de l'URL (?id=...) ---------- */
/* Construit le bloc média (vidéo/son/en attente) pour un chapitre ou un projet simple */
function buildMediaBlock(media){
  if(!media) return `<div class="thumb" style="aspect-ratio:16/9;">média à venir</div>`;
  if(media.type === "youtube"){
    const videoId = media.url.split("/").pop().split("?")[0];
    return `<div style="aspect-ratio:16/9; border-radius:10px; overflow:hidden;">
      <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
    </div>`;
  }
  if(media.type === "spotify"){
    const trackId = media.url.split("/").pop().split("?")[0];
    return `<iframe src="https://open.spotify.com/embed/track/${trackId}" width="100%" height="152" frameborder="0" allow="encrypted-media" style="border-radius:10px;"></iframe>`;
  }
  return `<div class="thumb" style="aspect-ratio:16/9;">${media.note || "média à venir"}</div>`;
}

function renderMarkdown(text){
  return (typeof marked !== "undefined") ? marked.parse(text || "") : `<p>${text || ""}</p>`;
}

/* Construit le HTML d'une fiche projet — utilisé à la fois par la page
   projet.html (gardée pour un lien partageable direct) et par la popup.
   Si le projet a des "chapters" (plusieurs volets : montage, vfx, visualizer...),
   ils s'affichent tous à la suite dans la même fiche, avec des onglets pour
   sauter directement à l'un d'eux. Sinon, c'est l'ancien format simple. */
function buildProjectDetailHTML(project){
  const hasChapters = Array.isArray(project.chapters) && project.chapters.length > 0;
  const chapters = hasChapters ? project.chapters : [{
    id: "main", tags: project.tags, title: project.title,
    role: project.role, credits: project.credits,
    media: project.media, description: project.description
  }];

  const tabsHTML = hasChapters ? `
    <div class="chapter-tabs">
      ${chapters.map(c => `<button class="chapter-tab" data-chapter-tab="${c.id}">${c.title}</button>`).join("")}
    </div>
  ` : "";

  const projectLayouts = CHAPTER_LAYOUTS[project.id] || {};

  const sectionsHTML = chapters.map(c => {
    const customLayout = projectLayouts[c.id];
    const bodyHTML = (customLayout && customLayout.blocks && customLayout.blocks.length)
      ? `<div class="block-canvas-wrapper" data-canvas-chapter="${project.id}:${c.id}"></div>`
      : `<div style="display:grid; grid-template-columns: minmax(280px, 480px) 1fr; gap: var(--gap-lg); margin-top: var(--gap-md); align-items:start;">
          <div>${buildMediaBlock(c.media)}</div>
          <div class="markdown-content">${renderMarkdown(c.description)}</div>
        </div>`;
    return `
    <section class="chapter-section" id="chapter-${c.id}">
      ${hasChapters ? `<h2>${c.title}</h2>` : ""}
      <p class="muted" style="margin-top:0.3rem;">${c.role || ""}${c.credits ? " — " + c.credits : ""}</p>
      ${bodyHTML}
    </section>
  `;
  }).join(hasChapters ? '<hr class="chapter-divider">' : "");

  return `
    <p class="eyebrow" style="margin-bottom:0.6rem;">${project.year}</p>
    <h1>${project.title}</h1>
    ${tabsHTML}
    ${sectionsHTML}
    <div class="tags" style="margin-top: var(--gap-lg);">
      ${projectTags(project).map(t => `<span class="tag">${BRANCHES[t] ? BRANCHES[t].label : t}</span>`).join("")}
    </div>
  `;
}

function renderProjectDetail(containerId, pathId){
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const project = PROJECTS.find(p => p.id === id);
  const container = document.getElementById(containerId);
  const pathEl = pathId ? document.getElementById(pathId) : null;

  if(!project){
    container.innerHTML = `<p class="muted">Projet introuvable.</p>`;
    return;
  }

  if(pathEl){
    const hasChapters = Array.isArray(project.chapters) && project.chapters.length > 0;
    const pathParts = hasChapters
      ? ["hub"]
      : ["hub", ...projectTags(project).map(t => BRANCHES[t] ? BRANCHES[t].label.toLowerCase() : t)];
    pathEl.textContent = pathParts.join(" / ") + " / " + project.title.toLowerCase();
  }

  if(project.popup_bg) document.body.style.background = project.popup_bg;
  container.innerHTML = buildProjectDetailHTML(project);
  bindChapterTabs(container, container);
}

/* ==========================================================
   POPUP FICHE PROJET
   Les fiches s'ouvrent par-dessus la page en cours (comme
   Contact/À propos), sans navigation ni entrée dans l'historique.
   Si on arrive depuis une branche précise (ex: VFX), la popup
   s'ouvre directement sur le chapitre correspondant.
   ========================================================== */
function initProjectPopups(){
  if(document.getElementById("project-popup")) return; // déjà en place

  const backdrop = document.createElement("div");
  backdrop.id = "project-popup-backdrop";
  backdrop.className = "project-popup-backdrop";
  document.body.appendChild(backdrop);

  const popup = document.createElement("div");
  popup.id = "project-popup";
  popup.className = "project-popup";
  popup.innerHTML = `<button class="popup-close" aria-label="Fermer">✕</button><div id="popup-content"></div>`;
  document.body.appendChild(popup);

  function close(){
    backdrop.classList.remove("visible");
    popup.classList.remove("open");
  }
  backdrop.addEventListener("click", close);
  popup.querySelector(".popup-close").addEventListener("click", close);
  document.addEventListener("keydown", e => { if(e.key === "Escape") close(); });
}

/* Active les onglets de chapitres : clic = défilement fluide jusqu'au chapitre */
function bindChapterTabs(scopeEl, scrollContainer){
  scopeEl.querySelectorAll("[data-chapter-tab]").forEach(btn => {
    btn.addEventListener("click", () => scrollToChapter(scrollContainer, btn.dataset.chapterTab, false));
  });
}

function scrollToChapter(scrollContainer, chapterId, instant){
  const section = scrollContainer.querySelector(`#chapter-${chapterId}`);
  if(!section) return;
  scrollContainer.querySelectorAll("[data-chapter-tab]").forEach(b =>
    b.classList.toggle("active", b.dataset.chapterTab === chapterId)
  );
  section.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "start" });
}

function openProjectPopup(id, contextTag){
  const project = PROJECTS.find(p => p.id === id);
  const content = document.getElementById("popup-content");
  if(!project || !content) return;

  content.innerHTML = buildProjectDetailHTML(project);
  const popupEl = document.getElementById("project-popup");
  popupEl.style.background = project.popup_bg ? project.popup_bg : "";
  bindChapterTabs(content, popupEl);
  mountBlockCanvases(content);

  document.getElementById("project-popup-backdrop").classList.add("visible");
  popupEl.classList.add("open");
  popupEl.scrollTop = 0;

  // Ouvre directement sur le chapitre lié à la branche d'où on vient
  if(contextTag && Array.isArray(project.chapters)){
    const target = project.chapters.find(c => (c.tags || []).includes(contextTag));
    if(target) scrollToChapter(popupEl, target.id, true);
  }
}

/* ==========================================================
   CANEVAS DE BLOCS (contenu libre d'un chapitre)
   Chaque chapitre peut avoir une disposition personnalisée :
   des blocs (texte, image, vidéo) positionnés librement, avec
   alignement magnétique entre eux en mode édition. Sans
   disposition personnalisée, l'ancien affichage (média + texte
   en deux colonnes) reste utilisé.
   ========================================================== */

/* Affiche tous les canevas présents dans une portion de page (mode lecture) */
function mountBlockCanvases(scopeEl){
  scopeEl.querySelectorAll("[data-canvas-chapter]").forEach(container => {
    const [projectId, chapterId] = container.dataset.canvasChapter.split(":");
    const layout = (CHAPTER_LAYOUTS[projectId] || {})[chapterId];
    if(!layout) return;
    renderBlockCanvas(container, layout, false);
  });
}

/* Construit le canevas lui-même (utilisé en lecture ET en édition) */
function renderBlockCanvas(container, layout, editable){
  container.innerHTML = "";
  const canvasWidth = layout.canvasWidth || 900;
  const canvasHeight = layout.canvasHeight || 460;

  const canvas = document.createElement("div");
  canvas.className = "block-canvas";
  canvas.style.width = canvasWidth + "px";
  canvas.style.height = canvasHeight + "px";

  (layout.blocks || []).forEach(block => {
    const el = document.createElement("div");
    el.className = "content-block";
    el.dataset.blockId = block.id;
    el.style.left = block.x + "px";
    el.style.top = block.y + "px";
    el.style.width = block.w + "px";
    el.style.height = block.h + "px";
    fillBlockContent(el, block);
    canvas.appendChild(el);
  });

  container.appendChild(canvas);
  container.classList.toggle("editable", !!editable);

  if(editable){
    canvas.style.transform = "none";
    container.style.height = canvasHeight + "px";
    container.style.overflowX = "auto";
  } else {
    const rescale = () => {
      const scale = container.clientWidth / canvasWidth;
      canvas.style.transform = `scale(${scale})`;
      container.style.height = (canvasHeight * scale) + "px";
    };
    if(window.ResizeObserver){
      new ResizeObserver(rescale).observe(container);
    }
    rescale();
  }

  return canvas;
}

function fillBlockContent(el, block){
  if(block.type === "text"){
    el.classList.add("markdown-content");
    el.innerHTML = renderMarkdown(block.content || "");
  } else if(block.type === "image"){
    el.innerHTML = block.url
      ? `<img src="${block.url}" alt="" style="width:100%; height:100%; object-fit:cover;">`
      : `<div class="thumb" style="width:100%; height:100%;">image à venir</div>`;
  } else if(block.type === "video"){
    el.innerHTML = block.url
      ? buildMediaBlock({ type: block.videoType || "youtube", url: block.url })
      : `<div class="thumb" style="width:100%; height:100%;">vidéo à venir</div>`;
  }
}

/* ---------- Mode édition des blocs (accessible via projet.html?id=...&edit=1) ---------- */

function ensureChapterLayout(project, chapter){
  CHAPTER_LAYOUTS[project.id] = CHAPTER_LAYOUTS[project.id] || {};
  if(!CHAPTER_LAYOUTS[project.id][chapter.id]){
    // Convertit l'affichage par défaut (média + texte) en deux blocs de départ,
    // pour ne pas repartir d'une page blanche.
    CHAPTER_LAYOUTS[project.id][chapter.id] = {
      canvasWidth: 900,
      canvasHeight: 460,
      blocks: [
        {
          id: "media-" + chapter.id,
          type: (chapter.media && chapter.media.type !== "pending") ? "video" : "image",
          url: chapter.media ? (chapter.media.url || "") : "",
          videoType: chapter.media ? chapter.media.type : "youtube",
          x: 20, y: 20, w: 420, h: 260
        },
        {
          id: "text-" + chapter.id,
          type: "text",
          content: chapter.description || "",
          x: 460, y: 20, w: 420, h: 420
        }
      ]
    };
  }
  return CHAPTER_LAYOUTS[project.id][chapter.id];
}

function initChapterEditor(project){
  const hasChapters = Array.isArray(project.chapters) && project.chapters.length > 0;
  const chapters = hasChapters ? project.chapters : [{
    id: "main", media: project.media, description: project.description
  }];

  chapters.forEach(chapter => {
    const layout = ensureChapterLayout(project, chapter);
    const section = document.getElementById("chapter-" + chapter.id);
    if(!section) return;

    let wrapper = section.querySelector(".block-canvas-wrapper");
    if(!wrapper){
      wrapper = document.createElement("div");
      wrapper.dataset.canvasChapter = project.id + ":" + chapter.id;
      section.appendChild(wrapper);
    }
    wrapper.className = "block-canvas-wrapper";

    const toolbar = document.createElement("div");
    toolbar.className = "block-toolbar";
    toolbar.innerHTML = `
      <button data-add="text">+ Texte</button>
      <button data-add="image">+ Image</button>
      <button data-add="video">+ Vidéo</button>
    `;
    section.insertBefore(toolbar, wrapper);

    function render(){
      const canvas = renderBlockCanvas(wrapper, layout, true);
      bindBlockInteractions(wrapper, canvas, layout, render);
    }
    render();

    toolbar.querySelectorAll("[data-add]").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.add;
        const id = type + "-" + Date.now();
        const block = { id, type, x: 40, y: 40, w: 260, h: type === "text" ? 140 : 200 };
        if(type === "text") block.content = "Nouveau texte";
        if(type === "image") block.url = "";
        if(type === "video"){ block.url = ""; block.videoType = "youtube"; }
        layout.blocks.push(block);
        render();
      });
    });
  });

  buildChapterEditPanel();
}

function bindBlockInteractions(wrapper, canvas, layout, rerender){
  const SNAP = 6;

  let guideX = canvas.querySelector(".snap-guide-x");
  let guideY = canvas.querySelector(".snap-guide-y");
  if(!guideX){ guideX = document.createElement("div"); guideX.className = "snap-guide-x"; canvas.appendChild(guideX); }
  if(!guideY){ guideY = document.createElement("div"); guideY.className = "snap-guide-y"; canvas.appendChild(guideY); }

  canvas.querySelectorAll(".content-block").forEach(el => {
    const block = layout.blocks.find(b => b.id === el.dataset.blockId);
    if(!block) return;

    const del = document.createElement("button");
    del.className = "block-delete";
    del.textContent = "✕";
    del.addEventListener("pointerdown", e => e.stopPropagation());
    del.addEventListener("click", e => {
      e.stopPropagation();
      layout.blocks = layout.blocks.filter(b => b.id !== block.id);
      rerender();
    });
    el.appendChild(del);

    const handle = document.createElement("div");
    handle.className = "block-resize-handle";
    el.appendChild(handle);

    if(block.type === "text"){
      el.addEventListener("dblclick", e => {
        if(e.target === handle || e.target === del) return;
        const textarea = document.createElement("textarea");
        textarea.className = "block-edit-textarea";
        textarea.value = block.content || "";
        el.innerHTML = "";
        el.appendChild(textarea);
        textarea.focus();
        textarea.addEventListener("pointerdown", ev => ev.stopPropagation());
        textarea.addEventListener("blur", () => {
          block.content = textarea.value;
          rerender();
        });
      });
    } else {
      el.addEventListener("dblclick", e => {
        if(e.target === handle || e.target === del) return;
        const label = block.type === "image" ? "URL de l'image" : "URL de la vidéo (YouTube ou Spotify)";
        const url = prompt(label + " :", block.url || "");
        if(url !== null){ block.url = url; rerender(); }
      });
    }

    let dragging = false, startX, startY, startBX, startBY;
    el.addEventListener("pointerdown", e => {
      if(e.target === handle || e.target === del || e.target.tagName === "TEXTAREA") return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startBX = block.x; startBY = block.y;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => {
      if(!dragging) return;
      const scale = canvas.getBoundingClientRect().width / layout.canvasWidth;
      const nx = startBX + (e.clientX - startX) / scale;
      const ny = startBY + (e.clientY - startY) / scale;
      const snapped = applySnap(block, nx, ny, layout.blocks, SNAP, guideX, guideY);
      block.x = snapped.x; block.y = snapped.y;
      el.style.left = block.x + "px";
      el.style.top = block.y + "px";
    });
    el.addEventListener("pointerup", () => {
      dragging = false;
      guideX.style.display = "none";
      guideY.style.display = "none";
    });

    let resizing = false, startW, startH;
    handle.addEventListener("pointerdown", e => {
      e.stopPropagation();
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      startW = block.w; startH = block.h;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", e => {
      if(!resizing) return;
      const scale = canvas.getBoundingClientRect().width / layout.canvasWidth;
      block.w = Math.max(80, startW + (e.clientX - startX) / scale);
      block.h = Math.max(60, startH + (e.clientY - startY) / scale);
      el.style.width = block.w + "px";
      el.style.height = block.h + "px";
    });
    handle.addEventListener("pointerup", e => {
      e.stopPropagation();
      resizing = false;
    });
  });
}

/* Aligne un bloc en cours de déplacement sur les bords/centres des autres
   blocs quand ils sont proches (comme les guides de Figma/Canva). */
function applySnap(block, x, y, allBlocks, threshold, guideXEl, guideYEl){
  let snappedX = x, snappedY = y, foundX = false, foundY = false;
  const edgesX = [x, x + block.w / 2, x + block.w];
  const edgesY = [y, y + block.h / 2, y + block.h];

  allBlocks.forEach(other => {
    if(other.id === block.id) return;
    const oEdgesX = [other.x, other.x + other.w / 2, other.x + other.w];
    const oEdgesY = [other.y, other.y + other.h / 2, other.y + other.h];

    edgesX.forEach(ex => oEdgesX.forEach(oex => {
      if(Math.abs(ex - oex) < threshold){
        snappedX = x + (oex - ex);
        foundX = true;
        guideXEl.style.left = oex + "px";
        guideXEl.style.display = "block";
      }
    }));
    edgesY.forEach(ey => oEdgesY.forEach(oey => {
      if(Math.abs(ey - oey) < threshold){
        snappedY = y + (oey - ey);
        foundY = true;
        guideYEl.style.top = oey + "px";
        guideYEl.style.display = "block";
      }
    }));
  });

  if(!foundX) guideXEl.style.display = "none";
  if(!foundY) guideYEl.style.display = "none";
  return { x: snappedX, y: snappedY };
}

function buildChapterEditPanel(){
  if(document.getElementById("chapter-edit-panel")) return;
  const panel = document.createElement("div");
  panel.id = "chapter-edit-panel";
  panel.className = "edit-panel";
  panel.innerHTML = `
    <p><strong>Édition des blocs</strong> — glisse/redimensionne, double-clic pour éditer un texte ou une URL.</p>
    <button id="chapter-copy" class="pill-link">Copier la disposition</button>
  `;
  document.body.appendChild(panel);

  document.getElementById("chapter-copy").addEventListener("click", () => {
    const json = JSON.stringify(CHAPTER_LAYOUTS, null, 2);
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(json).then(() => {
        alert("Copié ! Colle ce contenu dans data/chapter-layouts.json, puis envoie ce fichier sur GitHub.");
      }).catch(() => showLayoutFallback(json));
    } else {
      showLayoutFallback(json);
    }
  });
}
