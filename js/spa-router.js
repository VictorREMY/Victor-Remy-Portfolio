/* ==========================================================
   ROUTEUR SPA (Single Page Application)
   --------------------------------------------------------
   Objectif : naviguer entre les "pages" (hub, catégories,
   sous-catégories) SANS recharger le document — donc sans
   jamais recharger le fond vidéo ni recréer tout le contexte.

   Le fond (#water-bg), le bandeau et le conteneur de bulles
   restent en place en permanence. Seul le contenu des bulles
   (#syphon-field) est régénéré à chaque changement de vue.

   La "page courante" est encodée dans le hash de l'URL :
     #/hub                → arbre des branches principales
     #/musique            → sous-catégories de musique
     #/musique-son        → projets tagués musique-son
     #/projet/<id>        → ouvre la fiche projet (popup)
   Ainsi les liens restent partageables (copier l'URL).
   ========================================================== */

(function(){
  const FIELD_ID = "syphon-field";

  // Construit l'arbre/les items pour une vue donnée, puis rend les bulles.
  function renderView(route){
    const field = document.getElementById(FIELD_ID);
    if(!field) return;

    // Transition de sortie : fondu doux des bulles actuelles avant de les
    // remplacer (la plus fluide, comme convenu par défaut).
    field.classList.add("view-leaving");

    setTimeout(() => {
      field.innerHTML = "";
      field.classList.remove("view-leaving");

      const parts = route.split("/").filter(Boolean); // ex: ["musique-son"]
      const key = parts[0] || "accueil";

      // Met à jour le fil d'ariane
      updateBreadcrumb(key);

      if(key === "accueil"){
        // Écran d'accueil : une seule bulle "Victor Remy" qui mène au hub.
        renderSyphons(FIELD_ID, [{ label: "Victor Remy", href: "#/hub", key: "home" }]);
      }
      else if(key === "hub" || key === "home"){
        // Vue hub : arbre des branches principales
        const tree = getTopLevelBranches().map(bKey => ({
          label: BRANCHES[bKey].label,
          href: "#/" + bKey,
          key: bKey,
          children: getChildren(bKey).map(cKey => ({
            label: BRANCHES[cKey].label,
            href: "#/" + cKey,
            key: cKey,
            children: []
          }))
        }));
        renderSyphonTree(FIELD_ID, tree);
      }
      else if(BRANCHES[key] && getChildren(key).length){
        // Vue branche (musique/vfx/video) : ses sous-catégories
        const tree = getChildren(key).map(cKey => ({
          label: BRANCHES[cKey].label,
          href: "#/" + cKey,
          key: cKey,
          children: []
        }));
        renderSyphonTree(FIELD_ID, tree);
      }
      else if(BRANCHES[key]){
        // Vue sous-catégorie : liste des projets tagués
        const items = getProjectsByTag(key).map(p => ({
          label: p.title,
          href: "#/projet/" + p.id,
          key: p.id,
          popup: true,
          thumbnail: p.thumbnail || null,
          contextTag: key
        }));
        renderSyphons(FIELD_ID, items);
      }
      else {
        // Route inconnue → retour au hub
        location.hash = "#/hub";
        return;
      }

      if(typeof initEditMode === "function") initEditMode();
    }, 280); // durée du fondu de sortie (doit matcher le CSS)
  }

  // Met à jour le texte du fil d'ariane (chemin) en haut.
  function updateBreadcrumb(key){
    const el = document.getElementById("path-text");
    if(!el) return;
    if(key === "accueil"){ el.textContent = ""; return; }
    if(key === "hub" || key === "home"){ el.textContent = "hub"; return; }
    const b = BRANCHES[key];
    if(!b){ el.textContent = "hub"; return; }
    if(b.parent){
      el.textContent = "hub/" + b.parent + "/" + key;
    } else {
      el.textContent = "hub/" + key;
    }
  }

  // Gère l'ouverture d'une fiche projet via l'URL (#/projet/<id>)
  function handleProjectRoute(id){
    // Si aucune vue de bulles n'est encore affichée (arrivée directe par lien
    // partagé), on rend d'abord la sous-catégorie du projet en fond, pour que
    // la fermeture de la popup revienne sur des bulles et pas sur du vide.
    const field = document.getElementById(FIELD_ID);
    const fieldEmpty = field && field.children.length === 0;
    if(fieldEmpty && typeof PROJECTS !== "undefined"){
      const project = PROJECTS.find(p => p.id === id);
      if(project){
        const tags = (typeof projectTags === "function") ? projectTags(project) : [];
        const ctx = (tags && tags.length) ? tags[0] : "hub";
        renderViewImmediate(ctx);
      }
    }
    if(typeof openProjectPopup === "function"){
      openProjectPopup(id, null);
    }
  }

  // Rend une vue SANS transition de sortie (utilisé pour peupler le fond
  // instantanément derrière une popup ouverte par lien direct).
  function renderViewImmediate(key){
    const field = document.getElementById(FIELD_ID);
    if(!field) return;
    field.innerHTML = "";
    updateBreadcrumb(key);
    if(BRANCHES[key] && getChildren(key).length){
      const tree = getChildren(key).map(cKey => ({
        label: BRANCHES[cKey].label, href: "#/" + cKey, key: cKey, children: []
      }));
      renderSyphonTree(FIELD_ID, tree);
    } else if(BRANCHES[key]){
      const items = getProjectsByTag(key).map(p => ({
        label: p.title, href: "#/projet/" + p.id, key: p.id,
        popup: true, thumbnail: p.thumbnail || null, contextTag: key
      }));
      renderSyphons(FIELD_ID, items);
    } else {
      // fallback hub
      const tree = getTopLevelBranches().map(bKey => ({
        label: BRANCHES[bKey].label, href: "#/" + bKey, key: bKey,
        children: getChildren(bKey).map(cKey => ({
          label: BRANCHES[cKey].label, href: "#/" + cKey, key: cKey, children: []
        }))
      }));
      renderSyphonTree(FIELD_ID, tree);
    }
    if(typeof initEditMode === "function") initEditMode();
  }

  // Point d'entrée : lit le hash et affiche la bonne vue.
  function route(){
    let hash = location.hash.replace(/^#\/?/, ""); // enlève "#/" ou "#"
    if(!hash){ hash = "accueil"; }

    if(hash.startsWith("projet/")){
      // Fiche projet : on garde la vue de bulles derrière, on ouvre la popup.
      const id = hash.slice("projet/".length);
      handleProjectRoute(id);
      return;
    }
    renderView(hash);
  }

  // Expose une fonction de navigation pour les clics internes.
  window.spaNavigate = function(hashTarget){
    // hashTarget ex: "#/musique" ou "musique"
    const clean = hashTarget.replace(/^#\/?/, "");
    if(location.hash === "#/" + clean){
      // Déjà sur cette vue : forcer le re-rendu
      route();
    } else {
      location.hash = "#/" + clean;
    }
  };

  // Réagit aux changements d'URL (boutons précédent/suivant, liens).
  window.addEventListener("hashchange", route);

  // Premier rendu au chargement.
  window.spaInit = function(){
    route();
  };
})();
