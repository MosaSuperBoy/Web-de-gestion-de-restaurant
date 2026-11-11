/**
 * ============================================================================
 * CLUB AÉROSPATIAL D'ABIDJAN (CAA) - SCRIPT D'ADMINISTRATION (admin.js)
 * ============================================================================
 * Gestion des 6 onglets d'administration, différenciation des droits
 * (Super Admin vs Gestionnaire de publication), publication d'études avec
 * redimensionnement Canvas 1200px et stockage IndexedDB pour vidéos,
 * gestion/modification/suppression, liste des inscriptions avec export CSV,
 * ajout de gestionnaires, sécurité avancée et sauvegarde/restauration JSON.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CONTRÔLE D'ACCÈS & VÉRIFICATION DE LA SESSION
  // --------------------------------------------------------------------------
  const currentUser = window.AcaAuth ? window.AcaAuth.getUser() : null;

  // Si déconnecté ou simple membre -> Redirection immédiate
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'gestionnaire')) {
    window.location.href = 'connexion.html?admin=1';
    return;
  }

  const isSuperAdmin = currentUser.role === 'admin';

  // Éléments du DOM généraux
  const sessionUserBadge = document.getElementById('sessionUserBadge');
  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserRoleBadge = document.getElementById('sidebarUserRoleBadge');
  const defaultPasswordWarning = document.getElementById('defaultPasswordWarning');
  const adminGlobalFeedback = document.getElementById('adminGlobalFeedback');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const btnQuickLock = document.getElementById('btnQuickLock');

  // Mise à jour de l'identité de session
  if (sessionUserBadge) {
    sessionUserBadge.textContent = `${isSuperAdmin ? '🛡️' : '✍️'} ${currentUser.nom || currentUser.identifiant}`;
  }
  if (sidebarUserName) {
    sidebarUserName.textContent = currentUser.nom || currentUser.identifiant;
  }
  if (sidebarUserRoleBadge) {
    sidebarUserRoleBadge.textContent = isSuperAdmin ? 'Super Admin' : 'Gestionnaire';
    if (!isSuperAdmin) {
      sidebarUserRoleBadge.style.background = 'var(--accent2)';
      sidebarUserRoleBadge.style.color = '#FFFFFF';
    }
  }

  // Si Gestionnaire : masquer et restreindre les onglets non autorisés
  if (!isSuperAdmin) {
    ['navItemInscriptions', 'navItemGestionnaires', 'navItemSecurite', 'navItemSauvegarde'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // Alerte de mot de passe par défaut pour le Super Admin
  if (isSuperAdmin) {
    const secSettings = window.AcaAuth.getSecuritySettings();
    if (secSettings.is_default_password && defaultPasswordWarning) {
      defaultPasswordWarning.style.display = 'block';
      const btnGoSec = document.getElementById('btnGoToSecurityTab');
      if (btnGoSec) {
        btnGoSec.addEventListener('click', () => switchTab('tab-securite'));
      }
    }
  }

  // Déconnexion et verrouillage
  function handleLogout() {
    window.AcaAuth.logout();
    window.location.href = 'connexion.html';
  }

  if (btnAdminLogout) btnAdminLogout.addEventListener('click', handleLogout);
  if (btnQuickLock) btnQuickLock.addEventListener('click', () => {
    window.AcaAuth.logout();
    window.location.href = 'connexion.html?expire=1';
  });

  // Détecteur d'inactivité automatique
  window.AcaAuth.initInactivityWatcher(() => {
    window.location.href = 'connexion.html?expire=1';
  });

  // --------------------------------------------------------------------------
  // 2. GESTION DE LA NAVIGATION PAR ONGLETS (SIDEBAR)
  // --------------------------------------------------------------------------
  const navButtons = document.querySelectorAll('.admin-nav-btn');
  const tabPanes = document.querySelectorAll('.admin-tab-pane');

  function switchTab(tabKey) {
    // Si gestionnaire tente d'accéder à un onglet interdit, le rediriger vers publier
    if (!isSuperAdmin && ['tab-inscriptions', 'tab-gestionnaires', 'tab-securite', 'tab-sauvegarde'].includes(tabKey)) {
      tabKey = 'tab-publier';
    }

    navButtons.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabKey;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget);
    });

    const targetPaneId = 'pane-' + tabKey.replace('tab-', '');
    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === targetPaneId);
    });

    // Rafraîchissement ciblé selon l'onglet ouvert
    if (tabKey === 'tab-gerer') renderManagePubsTable();
    if (tabKey === 'tab-inscriptions' && isSuperAdmin) renderInscriptions();
    if (tabKey === 'tab-gestionnaires' && isSuperAdmin) renderGestionnaires();
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-tab');
      switchTab(tabKey);
    });
  });

  const btnQuickNewPub = document.getElementById('btnQuickNewPub');
  if (btnQuickNewPub) {
    btnQuickNewPub.addEventListener('click', () => switchTab('tab-publier'));
  }

  // --------------------------------------------------------------------------
  // 3. ONGLET 1 : PUBLICATION D'UNE ÉTUDE & APERÇU EN DIRECT
  // --------------------------------------------------------------------------
  const publishForm = document.getElementById('publishForm');
  const pubTitle = document.getElementById('pubTitle');
  const pubProgramSelect = document.getElementById('pubProgramSelect');
  const pubProgramNew = document.getElementById('pubProgramNew');
  const pubDate = document.getElementById('pubDate');
  const pubAuthor = document.getElementById('pubAuthor');
  const pubMediaType = document.getElementById('pubMediaType');
  const pubSummary = document.getElementById('pubSummary');

  // Photo
  const photoUploadBox = document.getElementById('photoUploadBox');
  const photoUrlBox = document.getElementById('photoUrlBox');
  const pubPhotoFile = document.getElementById('pubPhotoFile');
  const pubPhotoUrl = document.getElementById('pubPhotoUrl');

  // Vidéo
  const videoSourceGroup = document.getElementById('videoSourceGroup');
  const videoFileBox = document.getElementById('videoFileBox');
  const videoYoutubeBox = document.getElementById('videoYoutubeBox');
  const videoUrlBox = document.getElementById('videoUrlBox');
  const pubVideoFile = document.getElementById('pubVideoFile');
  const pubVideoYoutube = document.getElementById('pubVideoYoutube');
  const pubVideoDirect = document.getElementById('pubVideoDirect');

  // Aperçu
  const previewMedia = document.getElementById('previewMedia');
  const previewDate = document.getElementById('previewDate');
  const previewTitle = document.getElementById('previewTitle');
  const previewExcerpt = document.getElementById('previewExcerpt');
  const previewAuthor = document.getElementById('previewAuthor');

  let currentPhotoDataUrl = null;
  let currentVideoBlob = null;

  // Pré-remplir l'auteur avec le nom connecté
  if (pubAuthor && !pubAuthor.value) {
    pubAuthor.value = currentUser.nom ? `${currentUser.nom} (Équipe CAA)` : 'Club Aérospatial d Abidjan';
  }

  // Gestion du select de programme (+ option nouveau programme)
  pubProgramSelect.addEventListener('change', () => {
    if (pubProgramSelect.value === '__nouveau__') {
      pubProgramNew.style.display = 'block';
      pubProgramNew.focus();
    } else {
      pubProgramNew.style.display = 'none';
    }
    updatePreview();
  });

  // Affichage/masquage de la configuration vidéo selon type de média
  pubMediaType.addEventListener('change', () => {
    videoSourceGroup.style.display = pubMediaType.value === 'video' ? 'block' : 'none';
    updatePreview();
  });

  // Sources photo
  document.querySelectorAll('input[name="photoSource"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const val = radio.value;
      photoUploadBox.style.display = val === 'upload' ? 'block' : 'none';
      photoUrlBox.style.display = val === 'url' ? 'block' : 'none';
      if (val === 'svg') currentPhotoDataUrl = null;
      updatePreview();
    });
  });

  // Redimensionnement de photo par Canvas à 1200px max
  if (pubPhotoFile) {
    pubPhotoFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          currentPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          updatePreview();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (pubPhotoUrl) {
    pubPhotoUrl.addEventListener('input', updatePreview);
  }

  // Sources vidéo
  document.querySelectorAll('input[name="videoSource"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const val = radio.value;
      videoFileBox.style.display = val === 'file' ? 'block' : 'none';
      videoYoutubeBox.style.display = val === 'youtube' ? 'block' : 'none';
      videoUrlBox.style.display = val === 'url' ? 'block' : 'none';
      updatePreview();
    });
  });

  if (pubVideoFile) {
    pubVideoFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        currentVideoBlob = file;
        updatePreview();
      }
    });
  }

  if (pubVideoYoutube) pubVideoYoutube.addEventListener('input', updatePreview);
  if (pubVideoDirect) pubVideoDirect.addEventListener('input', updatePreview);

  // Écouteurs pour actualiser l'aperçu en direct
  [pubTitle, pubDate, pubAuthor, pubSummary].forEach(el => {
    if (el) el.addEventListener('input', updatePreview);
  });

  function getActiveProgram() {
    return pubProgramSelect.value === '__nouveau__'
      ? (pubProgramNew.value.trim() || 'Programme Spécial')
      : pubProgramSelect.value;
  }

  function updatePreview() {
    if (previewTitle) previewTitle.textContent = pubTitle.value.trim() || "Titre de votre publication";
    if (previewAuthor) previewAuthor.textContent = `✍️ ${pubAuthor.value.trim() || 'Équipe de recherche'}`;
    if (previewDate) {
      previewDate.textContent = `🗓️ ${window.AcaUI.formatDateFr(pubDate.value) || '15 avril 2026'}`;
    }
    if (previewExcerpt) {
      const full = pubSummary.value.trim();
      previewExcerpt.textContent = full ? (full.length > 140 ? full.slice(0, 140) + '...' : full) : "L'extrait technique s'affichera ici...";
    }

    if (previewMedia) {
      const mediaType = pubMediaType.value;
      const photoSource = document.querySelector('input[name="photoSource"]:checked')?.value || 'upload';

      if (currentPhotoDataUrl && photoSource === 'upload') {
        previewMedia.innerHTML = `<img src="${currentPhotoDataUrl}" alt="Aperçu">`;
      } else if (pubPhotoUrl.value.trim() && photoSource === 'url') {
        previewMedia.innerHTML = `<img src="${pubPhotoUrl.value.trim()}" alt="Aperçu">`;
      } else {
        const prog = getActiveProgram().toLowerCase();
        previewMedia.innerHTML = window.AcaUI.generateSvgIllustration(prog);
      }
    }
  }

  // Soumission de la publication
  publishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAdminFeedback();

    const title = pubTitle.value.trim();
    const program = getActiveProgram();
    const dateVal = pubDate.value;
    const authorVal = pubAuthor.value.trim();
    const mediaType = pubMediaType.value;
    const summaryVal = pubSummary.value.trim();

    if (!title || !authorVal || !summaryVal) {
      showAdminFeedback("Veuillez remplir le titre, l'auteur et le résumé technique.", "danger");
      return;
    }

    const submitBtn = document.getElementById('btnSubmitPublish');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Publication en cours...';

    try {
      const pubId = 'pub-' + Date.now();
      const excerptVal = summaryVal.length > 160 ? summaryVal.slice(0, 160) + '...' : summaryVal;

      const newPub = {
        id: pubId,
        date: dateVal,
        programme: program,
        titre: title,
        auteur: authorVal,
        media_type: mediaType,
        extrait: excerptVal,
        resume_complet: summaryVal,
        statut: 'publie'
      };

      // Gestion Photo
      const photoSource = document.querySelector('input[name="photoSource"]:checked')?.value || 'upload';
      if (photoSource === 'upload' && currentPhotoDataUrl) {
        newPub.image_data = currentPhotoDataUrl;
      } else if (photoSource === 'url' && pubPhotoUrl.value.trim()) {
        newPub.image_url = pubPhotoUrl.value.trim();
      } else {
        newPub.image_svg = program.toLowerCase();
      }

      // Gestion Vidéo
      if (mediaType === 'video') {
        const videoSource = document.querySelector('input[name="videoSource"]:checked')?.value || 'file';
        newPub.video_type = videoSource;

        if (videoSource === 'youtube') {
          newPub.video_url = pubVideoYoutube.value.trim();
        } else if (videoSource === 'url') {
          newPub.video_url = pubVideoDirect.value.trim();
        } else if (videoSource === 'file' && currentVideoBlob) {
          // Sauvegarde locale dans IndexedDB
          await window.AcaMediaDB.saveVideo(pubId, currentVideoBlob);
          newPub.has_local_video = true;
        }
      }

      // Ajout en tête des publications
      window.AcaPublications.add(newPub);

      showAdminFeedback(`
        🎉 <strong>Étude publiée avec succès !</strong><br>
        « ${escapeHtml(title)} » est désormais visible en tête du fil d'accueil.
      `, "success");

      // Réinitialisation du formulaire
      publishForm.reset();
      currentPhotoDataUrl = null;
      currentVideoBlob = null;
      pubDate.value = '2026-04-15';
      pubProgramNew.style.display = 'none';
      videoSourceGroup.style.display = 'none';
      updatePreview();

      // Mettre à jour le tableau de gestion
      renderManagePubsTable();

    } catch (err) {
      showAdminFeedback("Erreur lors de la publication : " + err.message, "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "🚀 Publier l'étude en tête de l'accueil";
    }
  });

  updatePreview();

  // --------------------------------------------------------------------------
  // 4. ONGLET 2 : GESTION DES ÉTUDES (TABLEAU, MODIFICATION & SUPPRESSION)
  // --------------------------------------------------------------------------
  const managePubsTableBody = document.getElementById('managePubsTableBody');
  const manageSearchInput = document.getElementById('manageSearchInput');
  const manageProgramFilter = document.getElementById('manageProgramFilter');

  // Modale d'édition
  const editPubModal = document.getElementById('editPubModal');
  const editPubForm = document.getElementById('editPubForm');
  const btnEditClose = document.getElementById('btnEditClose');
  const btnEditCancel = document.getElementById('btnEditCancel');
  const editPubId = document.getElementById('editPubId');
  const editPubTitle = document.getElementById('editPubTitle');
  const editPubProgram = document.getElementById('editPubProgram');
  const editPubDate = document.getElementById('editPubDate');
  const editPubSummary = document.getElementById('editPubSummary');

  function renderManagePubsTable() {
    if (!managePubsTableBody) return;

    const list = window.AcaPublications.getAll();
    const query = (manageSearchInput?.value || '').toLowerCase().trim();
    const progFilter = manageProgramFilter?.value || 'all';

    // Remplir le filtre des programmes
    if (manageProgramFilter) {
      const programs = Array.from(new Set(list.map(p => p.programme).filter(Boolean))).sort();
      const currentSelected = manageProgramFilter.value;
      manageProgramFilter.innerHTML = '<option value="all">Tous les programmes</option>' +
        programs.map(p => `<option value="${escapeHtml(p)}" ${p === currentSelected ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
    }

    const filtered = list.filter(p => {
      if (progFilter !== 'all' && p.programme !== progFilter) return false;
      if (query) {
        const inT = (p.titre || '').toLowerCase().includes(query);
        const inA = (p.auteur || '').toLowerCase().includes(query);
        if (!inT && !inA) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      managePubsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2rem; color:var(--muted);">
            Aucune étude ne correspond à votre recherche.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(pub => {
      let icon = '📷';
      if (pub.media_type === 'video') icon = '🎬';
      if (pub.media_type === 'texte') icon = '📄';

      rowsHtml += `
        <tr>
          <td>
            <div style="width:48px; height:32px; border-radius:4px; overflow:hidden; background:var(--bg); display:flex; align-items:center; justify-content:center;">
              ${icon}
            </div>
          </td>
          <td>
            <strong>${escapeHtml(pub.titre)}</strong>
          </td>
          <td><span class="pub-program-tag" style="position:static; font-size:0.7rem;">${escapeHtml(pub.programme)}</span></td>
          <td style="white-space:nowrap;">${window.AcaUI.formatDateFr(pub.date)}</td>
          <td>${icon} ${pub.media_type}</td>
          <td><small>${escapeHtml(pub.auteur || '')}</small></td>
          <td style="text-align:right; white-space:nowrap;">
            <button type="button" class="btn btn-sm btn-outline btn-edit-pub" data-id="${escapeHtml(pub.id)}" title="Modifier">
              ✏️
            </button>
            <button type="button" class="btn btn-sm btn-outline btn-delete-pub" data-id="${escapeHtml(pub.id)}" title="Supprimer définitivement" style="color:var(--danger); border-color:var(--danger);">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    managePubsTableBody.innerHTML = rowsHtml;

    // Événements d'édition
    managePubsTableBody.querySelectorAll('.btn-edit-pub').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditModal(id);
      });
    });

    // Événements de suppression
    managePubsTableBody.querySelectorAll('.btn-delete-pub').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const pub = list.find(p => p.id === id);
        if (!pub) return;

        if (confirm(`Êtes-vous certain de vouloir supprimer l'étude « ${pub.titre} » ? Cette action est irréversible.`)) {
          window.AcaPublications.delete(id);
          // Nettoyage éventuel dans IndexedDB
          if (window.AcaMediaDB) await window.AcaMediaDB.deleteVideo(id);
          renderManagePubsTable();
          showAdminFeedback("✓ Étude supprimée avec succès.", "info");
        }
      });
    });
  }

  if (manageSearchInput) manageSearchInput.addEventListener('input', renderManagePubsTable);
  if (manageProgramFilter) manageProgramFilter.addEventListener('change', renderManagePubsTable);

  // Modale d'édition
  function openEditModal(pubId) {
    const list = window.AcaPublications.getAll();
    const pub = list.find(p => p.id === pubId);
    if (!pub) return;

    editPubId.value = pub.id;
    editPubTitle.value = pub.titre || '';
    editPubDate.value = pub.date || '2026-04-15';
    editPubSummary.value = pub.resume_complet || pub.extrait || '';

    // Alimenter les programmes
    const progs = Array.from(new Set(list.map(p => p.programme).filter(Boolean)));
    editPubProgram.innerHTML = progs.map(p => `<option value="${p}" ${p === pub.programme ? 'selected' : ''}>${p}</option>`).join('');

    editPubModal.classList.add('open');
    editPubModal.setAttribute('aria-hidden', 'false');
  }

  function closeEditModal() {
    editPubModal.classList.remove('open');
    editPubModal.setAttribute('aria-hidden', 'true');
  }

  if (btnEditClose) btnEditClose.addEventListener('click', closeEditModal);
  if (btnEditCancel) btnEditCancel.addEventListener('click', closeEditModal);

  editPubForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = editPubId.value;
    const title = editPubTitle.value.trim();
    const prog = editPubProgram.value;
    const d = editPubDate.value;
    const sum = editPubSummary.value.trim();

    if (!title || !sum) {
      alert("Le titre et le résumé sont obligatoires.");
      return;
    }

    const excerpt = sum.length > 160 ? sum.slice(0, 160) + '...' : sum;

    window.AcaPublications.update(id, {
      titre: title,
      programme: prog,
      date: d,
      resume_complet: sum,
      extrait: excerpt
    });

    closeEditModal();
    renderManagePubsTable();
    showAdminFeedback("✓ Étude mise à jour avec succès.", "success");
  });

  // --------------------------------------------------------------------------
  // 5. ONGLET 3 : INSCRIPTIONS REÇUES & EXPORT CSV (ADMIN UNIQUEMENT)
  // --------------------------------------------------------------------------
  const inscriptionsTableBody = document.getElementById('inscriptionsTableBody');
  const inscriptionsModeInfo = document.getElementById('inscriptionsModeInfo');
  const inscriptionsSearch = document.getElementById('inscriptionsSearch');
  const btnRefreshInscriptions = document.getElementById('btnRefreshInscriptions');
  const btnExportCSV = document.getElementById('btnExportCSV');

  let loadedInscriptions = [];

  async function loadInscriptionsData() {
    const isServer = window.AcaSupabase && window.AcaSupabase.isConfigured();
    let data = [];

    if (inscriptionsModeInfo) {
      if (isServer) {
        inscriptionsModeInfo.className = 'alert alert-success';
        inscriptionsModeInfo.innerHTML = `🌐 <strong>Base Supabase connectée :</strong> Consultation des demandes enregistrées sur votre projet cloud distant.`;
      } else {
        inscriptionsModeInfo.className = 'alert alert-warning';
        inscriptionsModeInfo.innerHTML = `⚠️ <strong>Mode Local :</strong> Affichage des demandes enregistrées dans ce navigateur. Renseignez <code>config.js</code> pour synchroniser avec Supabase.`;
      }
    }

    if (isServer) {
      try {
        const remote = await window.AcaSupabase.getInscriptions();
        if (Array.isArray(remote)) {
          data = remote.map(r => ({ ...r, source: 'serveur' }));
        }
      } catch (e) {
        console.warn("Échec lecture Supabase inscriptions, repli local:", e);
      }
    }

    // Récupérer également les inscriptions locales
    const local = window.AcaAuth ? window.AcaAuth.getLocalMembers() : [];
    // Fusion sans doublon d'email
    local.forEach(l => {
      if (!data.some(d => (d.email || '').toLowerCase() === (l.email || '').toLowerCase())) {
        data.push({ ...l, source: 'local' });
      }
    });

    loadedInscriptions = data;
    renderInscriptions();
  }

  function renderInscriptions() {
    if (!inscriptionsTableBody) return;

    const query = (inscriptionsSearch?.value || '').toLowerCase().trim();
    const filtered = loadedInscriptions.filter(item => {
      if (!query) return true;
      const inN = (item.nom || '').toLowerCase().includes(query);
      const inE = (item.email || '').toLowerCase().includes(query);
      const inT = (item.telephone || '').toLowerCase().includes(query);
      return inN || inE || inT;
    });

    if (filtered.length === 0) {
      inscriptionsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2rem; color:var(--muted);">
            Aucune demande d'inscription enregistrée.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(item => {
      const isValide = item.statut === 'valide' || item.statut === 'actif';
      const statusBadge = isValide
        ? `<span class="badge-status valide">Validé</span>`
        : `<span class="badge-status en_attente">En attente</span>`;

      const sourceBadge = item.source === 'serveur'
        ? `<span class="announcement-badge" style="background:#E3F2FD; color:#1565C0;">Supabase</span>`
        : `<span class="announcement-badge" style="background:#FFF3E0; color:#E65100;">Navigateur</span>`;

      rowsHtml += `
        <tr>
          <td><strong>${escapeHtml(item.nom)}</strong></td>
          <td><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></td>
          <td>${escapeHtml(item.telephone || '—')}</td>
          <td>${statusBadge}</td>
          <td><small>${window.AcaUI.formatDateFr(item.created_at)}</small></td>
          <td>${sourceBadge}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button type="button" class="btn btn-sm btn-outline btn-toggle-status" data-id="${escapeHtml(item.id)}" data-current="${item.statut}">
              ${isValide ? 'Mettre en attente' : 'Valider'}
            </button>
            <button type="button" class="btn btn-sm btn-outline btn-delete-insc" data-id="${escapeHtml(item.id)}" data-source="${item.source}" style="color:var(--danger); border-color:var(--danger);">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    inscriptionsTableBody.innerHTML = rowsHtml;

    // Basculer statut
    inscriptionsTableBody.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const cur = btn.getAttribute('data-current');
        const targetStatut = (cur === 'valide' || cur === 'actif') ? 'en_attente' : 'valide';

        const item = loadedInscriptions.find(i => i.id === id);
        if (item) {
          item.statut = targetStatut;
          // Sauvegarder localement
          const localMembers = window.AcaAuth.getLocalMembers();
          const localItem = localMembers.find(l => l.id === id || l.email === item.email);
          if (localItem) {
            localItem.statut = targetStatut;
            window.AcaAuth.saveLocalMembers(localMembers);
          }
          renderInscriptions();
        }
      });
    });

    // Supprimer une inscription
    inscriptionsTableBody.querySelectorAll('.btn-delete-insc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const source = btn.getAttribute('data-source');

        if (confirm("Supprimer cette inscription ?")) {
          if (source === 'serveur' && window.AcaSupabase.isConfigured()) {
            try {
              await window.AcaSupabase.deleteInscription(id);
            } catch (err) {
              console.error(err);
            }
          }
          // Suppression en local
          const local = window.AcaAuth.getLocalMembers().filter(l => l.id !== id);
          window.AcaAuth.saveLocalMembers(local);

          loadedInscriptions = loadedInscriptions.filter(i => i.id !== id);
          renderInscriptions();
          showAdminFeedback("✓ Inscription supprimée.", "info");
        }
      });
    });
  }

  if (inscriptionsSearch) inscriptionsSearch.addEventListener('input', renderInscriptions);
  if (btnRefreshInscriptions) {
    btnRefreshInscriptions.addEventListener('click', async () => {
      btnRefreshInscriptions.innerHTML = '⏳ Chargement...';
      await loadInscriptionsData();
      btnRefreshInscriptions.innerHTML = '🔄 Rafraîchir';
      showAdminFeedback("✓ Liste des inscriptions actualisée.", "info");
    });
  }

  // Export CSV avec BOM UTF-8
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      if (loadedInscriptions.length === 0) {
        alert("Aucune inscription à exporter.");
        return;
      }

      let csv = '\uFEFF'; // BOM UTF-8 pour Excel
      csv += 'ID;Nom complet;Adresse e-mail;Téléphone;Statut;Date d\'inscription;Source\r\n';

      loadedInscriptions.forEach(i => {
        const id = `"${(i.id || '').replace(/"/g, '""')}"`;
        const nom = `"${(i.nom || '').replace(/"/g, '""')}"`;
        const email = `"${(i.email || '').replace(/"/g, '""')}"`;
        const tel = `"${(i.telephone || '').replace(/"/g, '""')}"`;
        const stat = `"${(i.statut || '').replace(/"/g, '""')}"`;
        const date = `"${(i.created_at || '').replace(/"/g, '""')}"`;
        const src = `"${(i.source || '').replace(/"/g, '""')}"`;
        csv += `${id};${nom};${email};${tel};${stat};${date};${src}\r\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `inscriptions_club_aeropatial_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // --------------------------------------------------------------------------
  // 6. ONGLET 4 : GESTIONNAIRES DE PUBLICATION (ADMIN UNIQUEMENT)
  // --------------------------------------------------------------------------
  const addGestionnaireForm = document.getElementById('addGestionnaireForm');
  const gestNom = document.getElementById('gestNom');
  const gestIdentifiant = document.getElementById('gestIdentifiant');
  const gestPassword = document.getElementById('gestPassword');
  const toggleGestPassBtn = document.getElementById('toggleGestPassBtn');
  const gestionnairesTableBody = document.getElementById('gestionnairesTableBody');

  if (toggleGestPassBtn && gestPassword) {
    toggleGestPassBtn.addEventListener('click', () => {
      const isPass = gestPassword.type === 'password';
      gestPassword.type = isPass ? 'text' : 'password';
      toggleGestPassBtn.textContent = isPass ? '🙈' : '👁️';
    });
  }

  function renderGestionnaires() {
    if (!gestionnairesTableBody) return;
    const list = window.AcaAuth.getGestionnaires();

    if (list.length === 0) {
      gestionnairesTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:1.5rem; color:var(--muted);">
            Aucun gestionnaire n'a encore été créé. Utilisez le formulaire à gauche pour en ajouter.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    list.forEach(g => {
      rowsHtml += `
        <tr>
          <td><strong>${escapeHtml(g.nom)}</strong></td>
          <td><code>${escapeHtml(g.identifiant)}</code></td>
          <td><span class="announcement-badge">Rédaction & Gestion</span></td>
          <td><small>${window.AcaUI.formatDateFr(g.created_at)}</small></td>
          <td style="text-align:right;">
            <button type="button" class="btn btn-sm btn-outline btn-delete-gest" data-id="${escapeHtml(g.id)}" style="color:var(--danger); border-color:var(--danger);">
              Révoquer
            </button>
          </td>
        </tr>
      `;
    });

    gestionnairesTableBody.innerHTML = rowsHtml;

    gestionnairesTableBody.querySelectorAll('.btn-delete-gest').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm("Révoquer l'accès de ce gestionnaire ? Il ne pourra plus publier.")) {
          const updated = list.filter(item => item.id !== id);
          window.AcaAuth.saveGestionnaires(updated);
          renderGestionnaires();
          showAdminFeedback("✓ Compte gestionnaire révoqué avec succès.", "info");
        }
      });
    });
  }

  if (addGestionnaireForm) {
    addGestionnaireForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAdminFeedback();

      const nom = gestNom.value.trim();
      const identifiant = gestIdentifiant.value.trim();
      const pwd = gestPassword.value;

      if (!nom || !identifiant || !pwd) {
        showAdminFeedback("Veuillez renseigner tous les champs du gestionnaire.", "danger");
        return;
      }

      if (pwd.length < 8 || !/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
        showAdminFeedback("Le mot de passe du gestionnaire doit comporter au moins 8 caractères, dont une lettre et un chiffre.", "danger");
        return;
      }

      const hash = await window.AcaCrypto.sha256(pwd);
      const list = window.AcaAuth.getGestionnaires();

      // Vérifier si l'identifiant existe déjà
      if (list.some(g => g.identifiant.toLowerCase() === identifiant.toLowerCase())) {
        showAdminFeedback("Cet identifiant de gestionnaire existe déjà.", "danger");
        return;
      }

      const newGest = {
        id: 'gest-' + Date.now(),
        nom: nom,
        identifiant: identifiant,
        password_hash: hash,
        created_at: new Date().toISOString()
      };

      list.push(newGest);
      window.AcaAuth.saveGestionnaires(list);

      addGestionnaireForm.reset();
      renderGestionnaires();
      showAdminFeedback(`✓ Gestionnaire ${escapeHtml(nom)} créé avec succès !`, "success");
    });
  }

  // --------------------------------------------------------------------------
  // 7. ONGLET 5 : SÉCURITÉ DU COMPTE ADMINISTRATEUR (ADMIN UNIQUEMENT)
  // --------------------------------------------------------------------------
  const changeAdminPasswordForm = document.getElementById('changeAdminPasswordForm');
  const currAdminPass = document.getElementById('currAdminPass');
  const newPassInput = document.getElementById('newPassInput');
  const newPassInputConfirm = document.getElementById('newPassInputConfirm');
  const btnGenPass = document.getElementById('btnGenPass');
  const secStrengthFill = document.getElementById('secStrengthFill');
  const secStrengthLabel = document.getElementById('secStrengthLabel');
  const pwdLastChangeInfo = document.getElementById('pwdLastChangeInfo');

  const securityQuestionForm = document.getElementById('securityQuestionForm');
  const secQuestionInput = document.getElementById('secQuestionInput');
  const secAnswerInput = document.getElementById('secAnswerInput');
  const inactivitySelect = document.getElementById('inactivitySelect');
  const btnSaveInactivity = document.getElementById('btnSaveInactivity');

  // Affichage de la date de dernière modif et de la question actuelle
  function initSecurityTab() {
    if (!isSuperAdmin) return;
    const secSettings = window.AcaAuth.getSecuritySettings();

    if (pwdLastChangeInfo) {
      pwdLastChangeInfo.textContent = `Dernière modification : ${window.AcaUI.formatDateFr(secSettings.last_password_change || '2026-01-01')}`;
    }
    if (secQuestionInput) {
      secQuestionInput.value = secSettings.security_question || "Quel est le nom de la première fusée-sonde expérimentale ivoirienne (projet fictif) ?";
    }
    if (inactivitySelect) {
      inactivitySelect.value = String(secSettings.inactivity_minutes || 30);
    }
  }

  // Boutons œil
  setupEye(document.getElementById('toggleCurrPassBtn'), currAdminPass);
  setupEye(document.getElementById('toggleNewSecPassBtn'), newPassInput);

  function setupEye(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? '🙈' : '👁️';
    });
  }

  // Jauge live pour nouveau mot de passe sécurité
  if (newPassInput) {
    newPassInput.addEventListener('input', () => {
      const p = newPassInput.value;
      const tests = [p.length >= 8, /[A-Z]/.test(p), /[a-z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)];
      const score = tests.filter(Boolean).length;

      const colors = ['var(--muted)', '#E53935', '#FB8C00', '#FDD835', '#1E88E5', '#43A047'];
      const labels = ['Non renseigné', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Excellent'];
      const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];

      secStrengthFill.style.width = p.length === 0 ? '0%' : widths[score];
      secStrengthFill.style.backgroundColor = colors[score];
      secStrengthLabel.textContent = labels[score];
      secStrengthLabel.style.color = colors[score];
    });
  }

  // Générateur de mot de passe fort (14 caractères alphanumériques + symboles)
  if (btnGenPass) {
    btnGenPass.addEventListener('click', () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
      let pass = '';
      for (let i = 0; i < 14; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      newPassInput.value = pass;
      newPassInputConfirm.value = pass;
      newPassInput.type = 'text';
      newPassInputConfirm.type = 'text';
      newPassInput.dispatchEvent(new Event('input'));
      showAdminFeedback(`⚡ Mot de passe fort généré : <code>${pass}</code> (Champs automatiquement remplis)`, "info");
    });
  }

  // Changement de mot de passe
  if (changeAdminPasswordForm) {
    changeAdminPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAdminFeedback();

      const curr = currAdminPass.value;
      const next = newPassInput.value;
      const conf = newPassInputConfirm.value;

      const secSettings = window.AcaAuth.getSecuritySettings();
      const currHash = await window.AcaCrypto.sha256(curr);

      if (currHash !== secSettings.password_hash) {
        showAdminFeedback("Le mot de passe actuel est incorrect.", "danger");
        currAdminPass.focus();
        return;
      }

      if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
        showAdminFeedback("Le nouveau mot de passe doit comporter au moins 8 caractères, une lettre et un chiffre.", "danger");
        newPassInput.focus();
        return;
      }

      if (next !== conf) {
        showAdminFeedback("La confirmation ne correspond pas au nouveau mot de passe.", "danger");
        newPassInputConfirm.focus();
        return;
      }

      const nextHash = await window.AcaCrypto.sha256(next);
      if (nextHash === currHash) {
        showAdminFeedback("Le nouveau mot de passe ne peut pas être identique à l'ancien.", "warning");
        return;
      }

      secSettings.password_hash = nextHash;
      secSettings.is_default_password = false;
      secSettings.last_password_change = new Date().toISOString();
      window.AcaAuth.saveSecuritySettings(secSettings);

      // Cacher le bandeau d'alerte rouge
      if (defaultPasswordWarning) defaultPasswordWarning.style.display = 'none';

      changeAdminPasswordForm.reset();
      initSecurityTab();
      showAdminFeedback("✓ Mot de passe administrateur modifié avec succès !", "success");
    });
  }

  // Question de récupération
  if (securityQuestionForm) {
    securityQuestionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAdminFeedback();

      const q = secQuestionInput.value.trim();
      const a = secAnswerInput.value.trim();

      if (!q || !a) {
        showAdminFeedback("Veuillez renseigner la question et la réponse.", "danger");
        return;
      }

      const normalizedAnswer = window.AcaCrypto.normalizeAnswer(a);
      const answerHash = await window.AcaCrypto.sha256(normalizedAnswer);

      const secSettings = window.AcaAuth.getSecuritySettings();
      secSettings.security_question = q;
      secSettings.security_answer_hash = answerHash;
      window.AcaAuth.saveSecuritySettings(secSettings);

      secAnswerInput.value = '';
      showAdminFeedback("✓ Question et réponse de récupération mises à jour avec succès !", "success");
    });
  }

  // Inactivité
  if (btnSaveInactivity && inactivitySelect) {
    btnSaveInactivity.addEventListener('click', () => {
      const minutes = parseInt(inactivitySelect.value, 10);
      const secSettings = window.AcaAuth.getSecuritySettings();
      secSettings.inactivity_minutes = minutes;
      window.AcaAuth.saveSecuritySettings(secSettings);
      showAdminFeedback(`✓ Délai d'inactivité configuré sur ${minutes} minutes.`, "info");
    });
  }

  // --------------------------------------------------------------------------
  // 8. ONGLET 6 : SAUVEGARDE & RESTAURATION (ADMIN UNIQUEMENT)
  // --------------------------------------------------------------------------
  const btnExportJSON = document.getElementById('btnExportJSON');
  const importJSONFile = document.getElementById('importJSONFile');
  const btnImportJSON = document.getElementById('btnImportJSON');
  const btnResetDemoData = document.getElementById('btnResetDemoData');

  if (btnExportJSON) {
    btnExportJSON.addEventListener('click', () => {
      const publications = window.AcaPublications.getAll();
      const dataStr = JSON.stringify(publications, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `publications_club_aeropatial_2026_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showAdminFeedback("✓ Export JSON téléchargé avec succès.", "success");
    });
  }

  if (btnImportJSON && importJSONFile) {
    btnImportJSON.addEventListener('click', () => {
      const file = importJSONFile.files[0];
      if (!file) {
        alert("Veuillez d'abord sélectionner un fichier JSON.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) {
            throw new Error("Le fichier ne contient pas un tableau valide d'études.");
          }
          if (confirm(`Importer ces ${imported.length} publications ? Elles remplaceront le jeu actuel.`)) {
            window.AcaPublications.saveAll(imported);
            importJSONFile.value = '';
            renderManagePubsTable();
            showAdminFeedback(`✓ ${imported.length} publications importées avec succès !`, "success");
          }
        } catch (err) {
          showAdminFeedback("Erreur lors de la lecture du fichier JSON : " + err.message, "danger");
        }
      };
      reader.readAsText(file);
    });
  }

  if (btnResetDemoData) {
    btnResetDemoData.addEventListener('click', () => {
      if (confirm("Réinitialiser l'ensemble des études aux 9 publications réalistes de démonstration 2026 ?")) {
        window.AcaPublications.resetToDemo();
        renderManagePubsTable();
        showAdminFeedback("✓ Les 9 publications de démonstration 2026 ont été restaurées avec succès.", "info");
      }
    });
  }

  // --------------------------------------------------------------------------
  // UTILITAIRES DE NOTIFICATION ADMIN
  // --------------------------------------------------------------------------
  function showAdminFeedback(msg, type) {
    if (!adminGlobalFeedback) return;
    adminGlobalFeedback.className = `alert alert-${type}`;
    adminGlobalFeedback.innerHTML = msg;
    adminGlobalFeedback.style.display = 'block';
    adminGlobalFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearAdminFeedback() {
    if (!adminGlobalFeedback) return;
    adminGlobalFeedback.style.display = 'none';
    adminGlobalFeedback.innerHTML = '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // --------------------------------------------------------------------------
  // INITIALISATION
  // --------------------------------------------------------------------------
  renderManagePubsTable();
  if (isSuperAdmin) {
    loadInscriptionsData();
    renderGestionnaires();
    initSecurityTab();
  }
});

