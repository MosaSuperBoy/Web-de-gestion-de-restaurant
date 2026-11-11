/**
 * ============================================================================
 * CLUB AÉROSPATIAL D'ABIDJAN (CAA) - SCRIPT DE LA PAGE D'ACCUEIL (accueil.js)
 * ============================================================================
 * Gestion du fil des publications, recherche instantanée, filtres par programme,
 * pagination numérotée (6 par page), fiche modale accessible avec lecteur vidéo
 * universel (YouTube / MP4 / IndexedDB local) et compteurs dynamiques.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Constantes de pagination
  const ITEMS_PER_PAGE = 6;
  let currentPage = 1;
  let selectedProgram = 'all';
  let searchQuery = '';
  let activeBlobUrl = null; // Pour nettoyage URL.revokeObjectURL

  // Éléments du DOM
  const authSlot = document.getElementById('authSlot');
  const countPubsEl = document.getElementById('countPubs');
  const countProgramsEl = document.getElementById('countPrograms');
  const currentSeasonEl = document.getElementById('currentSeason');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearch');
  const programChipsContainer = document.getElementById('programChips');
  const resultsCountEl = document.getElementById('resultsCount');
  const publicationsGrid = document.getElementById('publicationsGrid');
  const paginationWrapper = document.getElementById('paginationWrapper');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationControls = document.getElementById('paginationControls');
  const pubModal = document.getElementById('pubModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBody = document.getElementById('modalBody');

  // --------------------------------------------------------------------------
  // 1. GESTION DE L'EN-TÊTE ET DE LA SESSION UTILISATEUR
  // --------------------------------------------------------------------------
  function renderHeaderAuth() {
    const user = window.AcaAuth ? window.AcaAuth.getUser() : null;
    if (!authSlot) return;

    if (user) {
      const isPrivileged = user.role === 'admin' || user.role === 'gestionnaire';
      const roleLabel = user.role === 'admin' ? 'Admin' : (user.role === 'gestionnaire' ? 'Gestionnaire' : 'Membre');
      const icon = isPrivileged ? '🛡️' : '👤';

      authSlot.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
          ${isPrivileged ? `
            <a href="admin.html" class="btn btn-sm btn-secondary" title="Accéder au tableau de bord">
              ⚙️ Tableau de bord
            </a>
          ` : ''}
          <span style="font-size:0.88rem; font-weight:600; color:var(--txt);">
            ${icon} ${escapeHtml(user.nom || user.identifiant)} <small style="color:var(--muted); font-size:0.75rem;">(${roleLabel})</small>
          </span>
          <button type="button" class="btn btn-sm btn-outline" id="btnLogoutHeader" title="Fermer la session">
            Déconnexion
          </button>
        </div>
      `;

      const btnLogout = document.getElementById('btnLogoutHeader');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => {
          window.AcaAuth.logout();
          renderHeaderAuth();
          window.location.reload();
        });
      }
    } else {
      authSlot.innerHTML = `
        <a href="connexion.html" class="btn btn-outline">
          <span class="icon">👤</span> Espace membre
        </a>
      `;
    }
  }

  // --------------------------------------------------------------------------
  // 2. RÉCUPÉRATION & COMPTEURS DES PUBLICATIONS
  // --------------------------------------------------------------------------
  function getPublications() {
    if (!window.AcaPublications) return [];
    return window.AcaPublications.getAll();
  }

  function updateCounters(publications) {
    if (countPubsEl) countPubsEl.textContent = publications.length;

    const programs = new Set(publications.map(p => p.programme).filter(Boolean));
    if (countProgramsEl) countProgramsEl.textContent = programs.size;

    if (currentSeasonEl) currentSeasonEl.textContent = '2026';
  }

  // --------------------------------------------------------------------------
  // 3. CONSTRUCTION DES FILTRES PAR PROGRAMME (PUCES)
  // --------------------------------------------------------------------------
  function renderProgramChips(publications) {
    if (!programChipsContainer) return;

    const programCounts = {};
    publications.forEach(p => {
      const prog = p.programme || 'Autre';
      programCounts[prog] = (programCounts[prog] || 0) + 1;
    });

    const programsList = Object.keys(programCounts).sort();

    let html = `
      <button type="button" class="chip-btn ${selectedProgram === 'all' ? 'active' : ''}" data-program="all">
        Tous les programmes <span class="chip-badge">${publications.length}</span>
      </button>
    `;

    programsList.forEach(prog => {
      const activeClass = selectedProgram === prog ? 'active' : '';
      html += `
        <button type="button" class="chip-btn ${activeClass}" data-program="${escapeHtml(prog)}">
          ${escapeHtml(prog)} <span class="chip-badge">${programCounts[prog]}</span>
        </button>
      `;
    });

    programChipsContainer.innerHTML = html;

    programChipsContainer.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedProgram = btn.getAttribute('data-program');
        currentPage = 1;
        renderProgramChips(publications);
        renderFilteredPublications();
      });
    });
  }

  // --------------------------------------------------------------------------
  // 4. FILTRAGE, RECHERCHE & TRI PAR DATE DÉCROISSANTE
  // --------------------------------------------------------------------------
  function getFilteredAndSortedPublications() {
    const list = getPublications();

    const filtered = list.filter(pub => {
      // Filtre programme
      if (selectedProgram !== 'all' && pub.programme !== selectedProgram) {
        return false;
      }
      // Filtre recherche instantanée
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const inTitle = (pub.titre || '').toLowerCase().includes(query);
        const inExcerpt = (pub.extrait || '').toLowerCase().includes(query);
        const inResume = (pub.resume_complet || '').toLowerCase().includes(query);
        const inProg = (pub.programme || '').toLowerCase().includes(query);
        const inAuthor = (pub.auteur || '').toLowerCase().includes(query);
        if (!inTitle && !inExcerpt && !inResume && !inProg && !inAuthor) {
          return false;
        }
      }
      return true;
    });

    // Tri par date décroissante (plus récent au début)
    filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return filtered;
  }

  // --------------------------------------------------------------------------
  // 5. AFFICHAGE DES CARTES ET DE LA PAGINATION
  // --------------------------------------------------------------------------
  function renderFilteredPublications() {
    const filtered = getFilteredAndSortedPublications();
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    if (currentPage > totalPages) currentPage = totalPages;

    // Métadonnées des résultats
    if (resultsCountEl) {
      if (totalItems === 0) {
        resultsCountEl.textContent = 'Aucune publication ne correspond à vos critères de recherche.';
      } else if (totalItems === 1) {
        resultsCountEl.textContent = '1 étude trouvée';
      } else {
        resultsCountEl.textContent = `${totalItems} études trouvées • Affichage de 6 publications par page`;
      }
    }

    // Découpage pour pagination (6 par page)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Rendu de la grille
    if (pageItems.length === 0) {
      publicationsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem 1rem; text-align: center; background: var(--panel); border: 1px dashed var(--line); border-radius: var(--radius-md);">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🔭</div>
          <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">Aucune publication trouvée</h3>
          <p style="color: var(--muted); font-size: 0.95rem;">Essayez d'ajuster vos mots-clés ou sélectionnez « Tous les programmes ».</p>
        </div>
      `;
      if (paginationWrapper) paginationWrapper.style.display = 'none';
      return;
    }

    if (paginationWrapper) paginationWrapper.style.display = 'flex';

    let gridHtml = '';
    pageItems.forEach(pub => {
      let mediaBadgeIcon = '📷 Photo';
      if (pub.media_type === 'video') mediaBadgeIcon = '🎬 Vidéo';
      if (pub.media_type === 'texte') mediaBadgeIcon = '📄 Étude';

      // Rendu du visuel de couverture
      let visualHtml = '';
      if (pub.image_data) {
        visualHtml = `<img src="${pub.image_data}" alt="Illustration de l'étude ${escapeHtml(pub.titre)}" loading="lazy">`;
      } else if (pub.image_url) {
        visualHtml = `<img src="${pub.image_url}" alt="Illustration de l'étude ${escapeHtml(pub.titre)}" loading="lazy">`;
      } else if (pub.image_svg && window.AcaUI) {
        visualHtml = window.AcaUI.generateSvgIllustration(pub.image_svg);
      } else {
        visualHtml = window.AcaUI ? window.AcaUI.generateSvgIllustration('propulsion') : '';
      }

      const formattedDate = window.AcaUI ? window.AcaUI.formatDateFr(pub.date) : pub.date;

      gridHtml += `
        <article class="pub-card" data-id="${escapeHtml(pub.id)}" role="button" tabindex="0" aria-label="Consulter l'étude : ${escapeHtml(pub.titre)}">
          <div class="pub-card-media">
            ${visualHtml}
            <span class="pub-type-badge">${mediaBadgeIcon}</span>
            <span class="pub-program-tag">${escapeHtml(pub.programme || 'Général')}</span>
          </div>

          <div class="pub-card-body">
            <div class="pub-meta">
              <time datetime="${escapeHtml(pub.date)}">🗓️ ${formattedDate}</time>
            </div>
            <h3 class="pub-title">${escapeHtml(pub.titre)}</h3>
            <p class="pub-excerpt">${escapeHtml(pub.extrait || '')}</p>
            <div class="pub-card-footer">
              <span class="pub-author" title="${escapeHtml(pub.auteur || '')}">✍️ ${escapeHtml(pub.auteur || 'Club Aérospatial')}</span>
              <span class="pub-action-link">Consulter &rarr;</span>
            </div>
          </div>
        </article>
      `;
    });

    publicationsGrid.innerHTML = gridHtml;

    // Attachement des clics et événements clavier sur les cartes
    publicationsGrid.querySelectorAll('.pub-card').forEach(card => {
      const openCard = () => {
        const id = card.getAttribute('data-id');
        openModal(id);
      };
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openCard();
        }
      });
    });

    // Rendu des contrôles de pagination numérotée
    renderPaginationControls(totalPages);
  }

  function renderPaginationControls(totalPages) {
    if (!paginationInfo || !paginationControls) return;

    paginationInfo.textContent = `Page ${currentPage} sur ${totalPages}`;

    let controlsHtml = `
      <button type="button" class="page-btn" id="btnPagePrev" ${currentPage === 1 ? 'disabled' : ''} aria-label="Page précédente">
        &lsaquo; Précédent
      </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
      const activeClass = p === currentPage ? 'active' : '';
      controlsHtml += `
        <button type="button" class="page-btn ${activeClass}" data-page="${p}" aria-label="Aller à la page ${p}" ${p === currentPage ? 'aria-current="page"' : ''}>
          ${p}
        </button>
      `;
    }

    controlsHtml += `
      <button type="button" class="page-btn" id="btnPageNext" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Page suivante">
        Suivant &rsaquo;
      </button>
    `;

    paginationControls.innerHTML = controlsHtml;

    // Événements Précédent / Suivant et numéros
    const btnPrev = document.getElementById('btnPagePrev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderFilteredPublications();
          scrollToFeedTop();
        }
      });
    }

    const btnNext = document.getElementById('btnPageNext');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderFilteredPublications();
          scrollToFeedTop();
        }
      });
    }

    paginationControls.querySelectorAll('.page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page'), 10);
        if (p !== currentPage) {
          currentPage = p;
          renderFilteredPublications();
          scrollToFeedTop();
        }
      });
    });
  }

  function scrollToFeedTop() {
    const target = document.getElementById('publications-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // --------------------------------------------------------------------------
  // 6. FICHE MODALE ACCESSIBLE AVEC LECTEUR VIDÉO UNIVERSEL
  // --------------------------------------------------------------------------
  async function openModal(pubId) {
    const list = getPublications();
    const pub = list.find(p => p.id === pubId);
    if (!pub || !pubModal || !modalBody) return;

    // Nettoyage de l'URL Blob précédente si existante
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    }

    let mediaRenderHtml = '';

    if (pub.media_type === 'video') {
      if (pub.video_type === 'youtube' && pub.video_url) {
        const ytid = window.AcaUI.extractYouTubeId(pub.video_url);
        if (ytid) {
          mediaRenderHtml = `
            <div class="video-container-16-9">
              <iframe 
                src="https://www.youtube.com/embed/${ytid}?autoplay=1&rel=0" 
                title="${escapeHtml(pub.titre)}" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
              </iframe>
            </div>
          `;
        } else {
          mediaRenderHtml = `<div class="video-error-msg">⚠️ Lien YouTube non reconnu : ${escapeHtml(pub.video_url)}</div>`;
        }
      } else if (pub.video_type === 'url' && pub.video_url) {
        mediaRenderHtml = `
          <div class="video-container-16-9">
            <video controls autoplay playsinline>
              <source src="${escapeHtml(pub.video_url)}" type="video/mp4">
              Votre navigateur ne prend pas en charge la lecture vidéo HTML5.
            </video>
          </div>
        `;
      } else if (pub.video_type === 'file') {
        // Recherche dans IndexedDB
        let blob = null;
        if (window.AcaMediaDB) {
          try {
            blob = await window.AcaMediaDB.getVideo(pub.id);
          } catch (e) {
            console.error('Erreur lecture IndexedDB:', e);
          }
        }

        if (blob) {
          activeBlobUrl = URL.createObjectURL(blob);
          mediaRenderHtml = `
            <div class="video-container-16-9">
              <video controls autoplay playsinline>
                <source src="${activeBlobUrl}" type="${blob.type || 'video/mp4'}">
                Votre navigateur ne prend pas en charge la lecture de cette vidéo locale.
              </video>
            </div>
          `;
        } else {
          mediaRenderHtml = `
            <div class="video-error-msg">
              <strong>⚠️ Fichier vidéo local non synchronisé sur cet appareil</strong>
              <p style="margin-top:0.4rem; font-size:0.85rem;">Cette vidéo a été importée depuis un autre terminal ou dans une autre session locale. Pour une diffusion universelle, utilisez un lien YouTube ou configurez Supabase Storage dans config.js.</p>
            </div>
          `;
        }
      }
    } else {
      // Photo ou Étude texte
      let imgContent = '';
      if (pub.image_data) {
        imgContent = `<img src="${pub.image_data}" alt="${escapeHtml(pub.titre)}">`;
      } else if (pub.image_url) {
        imgContent = `<img src="${pub.image_url}" alt="${escapeHtml(pub.titre)}">`;
      } else if (pub.image_svg && window.AcaUI) {
        imgContent = window.AcaUI.generateSvgIllustration(pub.image_svg);
      } else {
        imgContent = window.AcaUI ? window.AcaUI.generateSvgIllustration('propulsion') : '';
      }

      mediaRenderHtml = `
        <div class="modal-media-wrapper">
          ${imgContent}
        </div>
      `;
    }

    const formattedDate = window.AcaUI ? window.AcaUI.formatDateFr(pub.date) : pub.date;

    modalBody.innerHTML = `
      ${mediaRenderHtml}
      <div class="modal-content-padding">
        <div class="modal-header-meta">
          <span class="pub-program-tag" style="position:static;">${escapeHtml(pub.programme || 'Général')}</span>
          <span class="pub-type-badge" style="position:static;">${pub.media_type === 'video' ? '🎬 Vidéo' : (pub.media_type === 'texte' ? '📄 Étude' : '📷 Photo')}</span>
          <span style="font-size:0.85rem; color:var(--muted);">🗓️ ${formattedDate}</span>
        </div>

        <h2 class="modal-title" id="modalTitle">${escapeHtml(pub.titre)}</h2>

        <div class="modal-meta-grid">
          <div class="modal-meta-item">
            <span class="modal-meta-label">Auteur(s) / Équipe</span>
            <span class="modal-meta-val">${escapeHtml(pub.auteur || 'Club Aérospatial d Abidjan')}</span>
          </div>
          <div class="modal-meta-item">
            <span class="modal-meta-label">Programme technique</span>
            <span class="modal-meta-val">${escapeHtml(pub.programme || 'Recherche fondamentale')}</span>
          </div>
          <div class="modal-meta-item">
            <span class="modal-meta-label">Classification</span>
            <span class="modal-meta-val">Publication Ouverte (Open Science)</span>
          </div>
        </div>

        <div class="modal-summary-section">
          <h3 style="font-size:1.15rem; margin-bottom:0.75rem; color:var(--gold);">Résumé technique & analyse</h3>
          <p>${escapeHtml(pub.resume_complet || pub.extrait || '')}</p>
        </div>
      </div>
    `;

    pubModal.classList.add('open');
    pubModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Bloque le scroll arrière-plan
  }

  function closeModal() {
    if (!pubModal) return;
    pubModal.classList.remove('open');
    pubModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    // Arrêt immédiat des flux vidéo/audio et libération mémoire
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    }
    if (modalBody) {
      modalBody.innerHTML = '';
    }
  }

  // Événements de fermeture de la modale
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (pubModal) {
    pubModal.addEventListener('click', (e) => {
      if (e.target === pubModal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pubModal && pubModal.classList.contains('open')) {
      closeModal();
    }
  });

  // --------------------------------------------------------------------------
  // 7. GESTION DE LA RECHERCHE INSTANTANÉE
  // --------------------------------------------------------------------------
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      currentPage = 1;
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      }
      renderFilteredPublications();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      currentPage = 1;
      searchInput.focus();
      renderFilteredPublications();
    });
  }

  // Fonction utilitaire d'échappement HTML anti-XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --------------------------------------------------------------------------
  // 8. INITIALISATION AU CHARGEMENT DE LA PAGE
  // --------------------------------------------------------------------------
  function init() {
    renderHeaderAuth();
    const publications = getPublications();
    updateCounters(publications);
    renderProgramChips(publications);
    renderFilteredPublications();

    // Détecteur d'inactivité
    if (window.AcaAuth) {
      window.AcaAuth.initInactivityWatcher(() => {
        window.location.href = 'connexion.html?expire=1';
      });
    }
  }

  init();
});

