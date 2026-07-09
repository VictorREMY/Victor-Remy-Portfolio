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

/* ==========================================================
   NAVIGATION PAR SYPHONS (remplace la nav texte + grilles)
   ========================================================== */

/* ---------- Fond animé (placeholder de l'effet eau — sera remplacé
   par l'export TouchDesigner de Victor plus tard) ---------- */
function initParticleField(canvasId){
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  let w, h, points = [];
  const spacing = 46;
  const mouse = { x: -9999, y: -9999 };

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    points = [];
    for(let y = 0; y < h + spacing; y += spacing){
      for(let x = 0; x < w + spacing; x += spacing){
        points.push({ x, y, ox: x, oy: y });
      }
    }
  }
  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });

  function draw(){
    ctx.clearRect(0, 0, w, h);
    for(const p of points){
      const dx = p.ox - mouse.x, dy = p.oy - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const radius = 160;
      let px = p.ox, py = p.oy;
      if(dist < radius){
        const force = (1 - dist / radius) * 18;
        const angle = Math.atan2(dy, dx);
        px += Math.cos(angle) * force;
        py += Math.sin(angle) * force;
      }
      const size = dist < radius ? 2.2 : 1.2;
      const alpha = dist < radius ? 0.85 : 0.2;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(94, 200, 216, ${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  resize();
  draw();
}

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
    { duration: 800, easing: "cubic-bezier(0.76,0,0.24,1)", fill: "forwards" }
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
    { duration: 750, easing: "cubic-bezier(0.6, 0, 0.9, 0.4)", fill: "forwards" }
  );

  zoomToPage(x, y, targetUrl);
}

/* ---------- Positions organiques prédéfinies pour les syphons (en %) ---------- */
const SYPHON_SLOTS = [
  { x: 50, y: 42 },
  { x: 25, y: 32 },
  { x: 72, y: 28 },
  { x: 78, y: 62 },
  { x: 22, y: 66 },
  { x: 48, y: 72 },
  { x: 60, y: 48 },
  { x: 35, y: 50 }
];

/* ---------- Génère et affiche les syphons dans un conteneur ----------
   items: [{ label, sublabel, href }] */
function renderSyphons(containerId, items){
  const field = document.getElementById(containerId);
  field.innerHTML = items.map((item, i) => {
    const slot = SYPHON_SLOTS[i % SYPHON_SLOTS.length];
    return `<a href="${item.href}" class="syphon" style="left:${slot.x}%; top:${slot.y}%;" data-syphon>
      <span>${item.label}</span>
      <span class="zoom-hint">${item.sublabel || "zoom in !"}</span>
    </a>`;
  }).join("");

  field.querySelectorAll("[data-syphon]").forEach(el => {
    el.addEventListener("click", function(e){
      e.preventDefault();
      vortexInto(this, this.getAttribute("href"));
    });
  });
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

/* ---------- Récupère les projets qui ont un tag donné ---------- */
function getProjectsByTag(tag){
  if(!tag || tag === "all") return PROJECTS;
  return PROJECTS.filter(p => p.tags.includes(tag));
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

  let mediaBlock = "";
  if(project.media.type === "youtube"){
    const videoId = project.media.url.split("/").pop().split("?")[0];
    mediaBlock = `<div style="aspect-ratio:16/9; border-radius:10px; overflow:hidden;">
      <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" title="${project.title}" frameborder="0" allowfullscreen></iframe>
    </div>`;
  } else if(project.media.type === "spotify"){
    const trackId = project.media.url.split("/").pop().split("?")[0];
    mediaBlock = `<iframe src="https://open.spotify.com/embed/track/${trackId}" width="100%" height="152" frameborder="0" allow="encrypted-media" style="border-radius:10px;"></iframe>`;
  } else {
    mediaBlock = `<div class="thumb" style="aspect-ratio:16/9;">${project.media.note || "média à venir"}</div>`;
  }

  // Chemin textuel simple, en haut à gauche de la page
  if(pathEl){
    const pathParts = ["hub", ...project.tags.map(t => BRANCHES[t].label.toLowerCase())];
    pathEl.textContent = pathParts.join(" / ") + " / " + project.title.toLowerCase();
  }

  container.innerHTML = `
    <p class="eyebrow" style="margin-bottom:0.6rem;">${project.year}</p>
    <h1>${project.title}</h1>
    <p class="muted" style="margin-top:0.6rem;">${project.role || ""}${project.credits ? " — " + project.credits : ""}</p>

    <div style="display:grid; grid-template-columns: minmax(280px, 480px) 1fr; gap: var(--gap-lg); margin-top: var(--gap-lg); align-items:start;">
      <div>${mediaBlock}</div>
      <p style="line-height:1.7; max-width:55ch;">${project.description}</p>
    </div>

    <div class="tags" style="margin-top: var(--gap-lg);">
      ${project.tags.map(t => `<span class="tag">${BRANCHES[t].label}</span>`).join("")}
    </div>
  `;
}
