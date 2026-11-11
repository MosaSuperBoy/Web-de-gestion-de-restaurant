/**
 * ============================================================================
 * CLUB AÉROSPATIAL D'ABIDJAN (CAA) - SCRIPT D'INSCRIPTION (inscription.js)
 * ============================================================================
 * Contrôles stricts en direct, jauge de robustesse (Très faible -> Excellent),
 * validation visuelle des 5 règles, bascule œil afficher/masquer,
 * hachage SHA-256 (aucun mot de passe en clair), transmission distante Supabase
 * ou locale avec avertissement, et connexion automatique post-adhésion.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Éléments du formulaire
  const form = document.getElementById('inscriptionForm');
  const nomInput = document.getElementById('nom');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('telephone');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('passwordConfirm');
  const consentCheckbox = document.getElementById('consent');
  const submitBtn = document.getElementById('btnSubmitInscription');

  // Éléments d'interface dynamique
  const modeBanner = document.getElementById('modeBanner');
  const formFeedback = document.getElementById('formFeedback');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const toggleConfirmBtn = document.getElementById('toggleConfirmBtn');
  const strengthBarFill = document.getElementById('strengthBarFill');
  const strengthText = document.getElementById('strengthText');

  // Règles de sécurité du mot de passe
  const ruleLen = document.getElementById('rule-len');
  const ruleUpper = document.getElementById('rule-upper');
  const ruleLower = document.getElementById('rule-lower');
  const ruleNum = document.getElementById('rule-num');
  const ruleSpec = document.getElementById('rule-spec');

  // --------------------------------------------------------------------------
  // 1. DÉTECTION DU MODE (LOCAL OU SERVEUR SUPABASE)
  // --------------------------------------------------------------------------
  function checkMode() {
    const isServer = window.AcaSupabase && window.AcaSupabase.isConfigured();
    if (isServer) {
      modeBanner.className = 'alert alert-success';
      modeBanner.innerHTML = `
        <span>🌐 <strong>Mode Serveur Connecté :</strong> Votre inscription sera immédiatement transmise dans la base Supabase et apparaîtra en direct dans l'espace d'administration.</span>
      `;
    } else {
      modeBanner.className = 'alert alert-warning';
      modeBanner.innerHTML = `
        <span>⚠️ <strong>Mode Local Actif :</strong> Aucune base Supabase n'est renseignée dans <code>config.js</code>. Votre demande sera conservée localement dans ce navigateur. Pour une transmission distante réelle, configurez l'URL et la clé dans <code>config.js</code>.</span>
      `;
    }
  }

  // --------------------------------------------------------------------------
  // 2. BASCULE AFFICHER / MASQUER LE MOT DE PASSE (ŒIL)
  // --------------------------------------------------------------------------
  function setupEyeToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? '🙈' : '👁️';
      btn.setAttribute('aria-label', isPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    });
  }

  setupEyeToggle(togglePasswordBtn, passwordInput);
  setupEyeToggle(toggleConfirmBtn, confirmInput);

  // --------------------------------------------------------------------------
  // 3. JAUGE DE ROBUSTESSE & VALIDATION DES RÈGLES EN TEMPS RÉEL
  // --------------------------------------------------------------------------
  function evaluatePassword(pwd) {
    const tests = {
      len: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      num: /[0-9]/.test(pwd),
      spec: /[^A-Za-z0-9]/.test(pwd)
    };

    // Mise à jour visuelle des 5 items de la liste
    updateRuleItem(ruleLen, tests.len);
    updateRuleItem(ruleUpper, tests.upper);
    updateRuleItem(ruleLower, tests.lower);
    updateRuleItem(ruleNum, tests.num);
    updateRuleItem(ruleSpec, tests.spec);

    // Calcul du score
    let score = 0;
    if (tests.len) score++;
    if (tests.upper) score++;
    if (tests.lower) score++;
    if (tests.num) score++;
    if (tests.spec) score++;

    // Ajustement de la jauge (5 crans)
    const levels = [
      { text: 'Non renseigné', color: 'var(--muted)', width: '0%' },
      { text: 'Très faible', color: '#E53935', width: '20%' },
      { text: 'Faible', color: '#FB8C00', width: '40%' },
      { text: 'Moyen', color: '#FDD835', width: '60%' },
      { text: 'Fort', color: '#1E88E5', width: '80%' },
      { text: 'Excellent', color: '#43A047', width: '100%' }
    ];

    const currentLevel = pwd.length === 0 ? levels[0] : levels[score];
    strengthBarFill.style.width = currentLevel.width;
    strengthBarFill.style.backgroundColor = currentLevel.color;
    strengthText.textContent = currentLevel.text;
    strengthText.style.color = currentLevel.color;

    return score === 5;
  }

  function updateRuleItem(el, isValid) {
    if (!el) return;
    el.classList.toggle('valid', isValid);
    const icon = el.querySelector('.rule-icon');
    if (icon) {
      icon.textContent = isValid ? '✓' : '○';
    }
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      evaluatePassword(passwordInput.value);
    });
  }

  // --------------------------------------------------------------------------
  // 4. CONTRÔLE DE VALIDITÉ ET SOUMISSION DU FORMULAIRE
  // --------------------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFeedback();

    const nom = nomInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const telephone = phoneInput ? phoneInput.value.trim() : '';
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    const consent = consentCheckbox.checked;

    // 1. Contrôle du nom (>= 3 caractères)
    if (nom.length < 3) {
      showFeedback('Le nom complet doit comporter au moins 3 caractères.', 'danger');
      nomInput.focus();
      return;
    }

    // 2. Contrôle de l'e-mail (RFC standard)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showFeedback("Veuillez saisir une adresse e-mail valide (ex: contact@domaine.ci).", 'danger');
      emailInput.focus();
      return;
    }

    // 3. E-mail différent de l'administrateur
    const secSettings = window.AcaAuth ? window.AcaAuth.getSecuritySettings() : {};
    const adminLogin = (secSettings.identifiant || 'administrateur').toLowerCase();
    if (email === adminLogin || email === 'admin@aeroclub-abidjan.ci' || email === 'administrateur') {
      showFeedback("Cette adresse e-mail est réservée à l'administration du club.", 'danger');
      emailInput.focus();
      return;
    }

    // 4. E-mail non déjà utilisé en local
    const localMembers = window.AcaAuth ? window.AcaAuth.getLocalMembers() : [];
    const alreadyExists = localMembers.some(m => (m.email || '').toLowerCase() === email);
    if (alreadyExists) {
      showFeedback("Cette adresse e-mail est déjà inscrite. Veuillez vous connecter.", 'warning');
      emailInput.focus();
      return;
    }

    // 5. Politique de mot de passe respectée (les 5 règles)
    const isStrong = evaluatePassword(password);
    if (!isStrong) {
      showFeedback("Votre mot de passe doit remplir l'ensemble des 5 critères de sécurité.", 'danger');
      passwordInput.focus();
      return;
    }

    // 6. Confirmation identique
    if (password !== confirm) {
      showFeedback("La confirmation du mot de passe ne correspond pas au mot de passe saisi.", 'danger');
      confirmInput.focus();
      return;
    }

    // 7. Case de consentement cochée
    if (!consent) {
      showFeedback("Vous devez accepter la politique de traitement des données pour continuer.", 'danger');
      consentCheckbox.focus();
      return;
    }

    // Tout est validé -> Préparation du dépôt avec mot de passe haché SHA-256
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Transmission sécurisée...';

    try {
      // Calcul de l'empreinte SHA-256 (jamais en clair)
      const passwordHash = await window.AcaCrypto.sha256(password);

      const memberPayload = {
        nom: nom,
        email: email,
        telephone: telephone || null,
        mot_de_passe: passwordHash,
        statut: 'en_attente',
        created_at: new Date().toISOString()
      };

      const isServer = window.AcaSupabase && window.AcaSupabase.isConfigured();

      if (isServer) {
        // Envoi au serveur Supabase REST
        try {
          await window.AcaSupabase.registerInscription(memberPayload);
        } catch (serverErr) {
          console.error('[Supabase Register Error]:', serverErr);
          throw new Error("Impossible d'enregistrer sur le serveur distant : " + serverErr.message);
        }
      }

      // Enregistrement également dans le stockage local (pour mode hors ligne ou redondance)
      localMembers.push({
        id: 'mem-' + Date.now(),
        ...memberPayload,
        source: isServer ? 'serveur' : 'local'
      });
      window.AcaAuth.saveLocalMembers(localMembers);

      // Connexion automatique de la session membre
      window.AcaAuth.setUser({
        role: 'membre',
        nom: nom,
        email: email,
        statut: 'en_attente',
        source: isServer ? 'serveur' : 'local'
      });

      // Message de succès et redirection vers accueil.html
      showFeedback(`
        🎉 <strong>Félicitations ${escapeHtml(nom)} !</strong><br>
        Votre adhésion a été enregistrée avec succès ${isServer ? 'sur le serveur Supabase' : 'en mémoire locale'}.
        Connexion automatique en cours, redirection vers l'accueil...
      `, 'success');

      setTimeout(() => {
        window.location.href = 'accueil.html';
      }, 1600);

    } catch (err) {
      showFeedback("Une erreur est survenue lors de l'inscription : " + err.message, 'danger');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🚀 Finaliser mon adhésion';
    }
  });

  // Utilitaires de notification
  function showFeedback(msg, type) {
    if (!formFeedback) return;
    formFeedback.className = `alert alert-${type}`;
    formFeedback.innerHTML = msg;
    formFeedback.style.display = 'block';
    formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearFeedback() {
    if (!formFeedback) return;
    formFeedback.style.display = 'none';
    formFeedback.innerHTML = '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Initialisation
  checkMode();
});

