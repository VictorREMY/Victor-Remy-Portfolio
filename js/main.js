/* ==========================================================
   FONCTIONS PARTAGÉES — utilisées par toutes les pages
   ========================================================== */

/* Les projets sont maintenant chargés depuis data/projects.json
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
function renderProjectDetail(containerId){
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const project = PROJECTS.find(p => p.id === id);
  const container = document.getElementById(containerId);

  if(!project){
    container.innerHTML = `<p class="muted">Projet introuvable.</p>`;
    return;
  }

  let mediaBlock = "";
  if(project.media.type === "youtube"){
    const videoId = project.media.url.split("/").pop().split("?")[0];
    mediaBlock = `<div class="thumb" style="aspect-ratio:16/9; padding:0;">
      <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" title="${project.title}" frameborder="0" allowfullscreen style="border-radius:8px;"></iframe>
    </div>`;
  } else if(project.media.type === "spotify"){
    const trackId = project.media.url.split("/").pop().split("?")[0];
    mediaBlock = `<iframe src="https://open.spotify.com/embed/track/${trackId}" width="100%" height="152" frameborder="0" allow="encrypted-media"></iframe>`;
  } else {
    mediaBlock = `<div class="thumb" style="aspect-ratio:16/9;">${project.media.note || "média à venir"}</div>`;
  }

  const breadcrumbTags = project.tags
    .map(t => `<a href="${BRANCHES[t].page}" data-transition>${BRANCHES[t].label}</a>`)
    .join(" · ");

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
      <p class="breadcrumb"><a href="hub.html" data-transition>Hub</a> / ${breadcrumbTags} / ${project.title}</p>
      <button class="pill-link" data-back><span>←</span> Retour</button>
    </div>
    <h1 style="margin-top:1rem;">${project.title}</h1>
    <p class="muted" style="margin-top:0.5rem;">${project.year}${project.role ? " — " + project.role : ""}${project.credits ? " — " + project.credits : ""}</p>
    <div class="tags" style="margin:1.5rem 0;">
      ${project.tags.map(t => `<span class="tag">${BRANCHES[t].label}</span>`).join("")}
    </div>
    <div style="max-width:640px; margin-bottom:2rem;">${mediaBlock}</div>
    <p style="max-width:60ch; line-height:1.7;">${project.description}</p>
  `;

  bindTransitionLinks(); // le fil d'Ariane vient d'être généré, on attache ses liens
  bindBackButtons();
}
