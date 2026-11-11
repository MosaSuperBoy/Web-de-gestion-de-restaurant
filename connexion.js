document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 60 * 1000;
  const ATTEMPTS_KEY = 'pluto_login_attempts';
  const LOCKED_UNTIL_KEY = 'pluto_login_locked_until';
  const form = document.getElementById('loginForm');
  const identifier = document.getElementById('adminIdentifiant');
  const password = document.getElementById('adminPassword');
  const feedback = document.getElementById('loginFeedback');
  const submitButton = document.getElementById('loginSubmit');
  const recovery = document.getElementById('forgotSection');
  const recoveryFeedback = document.getElementById('recoveryFeedback');
  const recoveryForm = document.getElementById('recoverForm');
  let securitySettings;

  function showMessage(element, message, isError) {
    element.textContent = message;
    element.hidden = false;
    element.classList.toggle('alert-danger', isError);
    element.classList.toggle('alert-success', !isError);
  }

  function getLockedUntil() {
    const stored = Number(localStorage.getItem(LOCKED_UNTIL_KEY));
    if (!Number.isSafeInteger(stored) || stored < 0) {
      localStorage.removeItem(LOCKED_UNTIL_KEY);
      return 0;
    }
    return stored;
  }

  function updateLockout() {
    const remaining = Math.max(0, getLockedUntil() - Date.now());
    if (remaining > 0) {
      submitButton.disabled = true;
      showMessage(feedback, `Accès temporairement bloqué. Veuillez réessayer dans ${Math.ceil(remaining / 1000)} seconde(s).`, true);
      return true;
    }
    submitButton.disabled = false;
    if (feedback.textContent.startsWith('Accès temporairement bloqué.')) feedback.hidden = true;
    return false;
  }

  function clearAttempts() {
    localStorage.removeItem(ATTEMPTS_KEY);
    localStorage.removeItem(LOCKED_UNTIL_KEY);
    submitButton.disabled = false;
    feedback.hidden = true;
  }

  function recordFailedAttempt(message) {
    const attempts = Number(localStorage.getItem(ATTEMPTS_KEY) || '0') + 1;
    if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error('Le compteur de tentatives de connexion est invalide.');

    if (attempts >= MAX_ATTEMPTS) {
      localStorage.setItem(ATTEMPTS_KEY, '0');
      localStorage.setItem(LOCKED_UNTIL_KEY, String(Date.now() + LOCKOUT_MS));
      updateLockout();
      return;
    }
    localStorage.setItem(ATTEMPTS_KEY, String(attempts));
    showMessage(feedback, `${message} Il vous reste ${MAX_ATTEMPTS - attempts} tentative(s).`, true);
  }

  function meetsPasswordPolicy(value) {
    return value.length >= 12
      && /[a-z]/.test(value)
      && /[A-Z]/.test(value)
      && /\d/.test(value)
      && /[^A-Za-z0-9]/.test(value);
  }

  async function redirectToDashboard() {
    showMessage(feedback, 'Connexion réussie. Ouverture de l’espace de gestion…', false);
    window.setTimeout(() => {
      window.location.href = 'boutique-admin.html';
    }, 350);
  }

  try {
    const user = window.RjmAuth.getUser();
    if (user) {
      window.location.replace('boutique-admin.html');
      return;
    }
    updateLockout();
    window.setInterval(updateLockout, 1000);
  } catch (error) {
    showMessage(feedback, error.message || 'Impossible de vérifier la session.', true);
  }

  document.getElementById('showPasswordBtn').addEventListener('click', event => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    event.currentTarget.textContent = visible ? 'Masquer' : 'Afficher';
    event.currentTarget.setAttribute('aria-pressed', String(visible));
    event.currentTarget.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (updateLockout()) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Vérification…';
    try {
      const username = identifier.value.trim();
      const passwordHash = await window.RjmCrypto.sha256(password.value);
      securitySettings = window.RjmAuth.getSecuritySettings();
      const administratorMatches = username.toLowerCase() === securitySettings.identifiant.toLowerCase()
        && passwordHash === securitySettings.password_hash;

      let user;
      if (administratorMatches) {
        user = { role: 'admin', nom: securitySettings.identifiant, identifiant: securitySettings.identifiant };
      } else {
        const managers = window.RjmAuth.getGestionnaires();
        const manager = managers.find(candidate => candidate
          && typeof candidate.identifiant === 'string'
          && candidate.identifiant.toLowerCase() === username.toLowerCase()
          && candidate.password_hash === passwordHash);
        if (manager) {
          user = { role: 'gestionnaire', nom: manager.nom || manager.identifiant, identifiant: manager.identifiant };
        }
      }

      if (!user) {
        recordFailedAttempt('Identifiant ou mot de passe incorrect.');
      } else {
        clearAttempts();
        window.RjmAuth.setUser(user);
        await redirectToDashboard();
      }
    } catch (error) {
      showMessage(feedback, error.message || 'Une erreur empêche la connexion.', true);
    } finally {
      submitButton.textContent = 'Ouvrir mon espace';
      if (getLockedUntil() <= Date.now()) submitButton.disabled = false;
    }
  });

  document.getElementById('forgotPasswordBtn').addEventListener('click', () => {
    try {
      securitySettings = window.RjmAuth.getSecuritySettings();
      document.getElementById('securityQuestionDisplay').textContent = securitySettings.security_question;
      recovery.hidden = false;
      recoveryForm.hidden = true;
      recoveryFeedback.hidden = true;
      document.getElementById('securityAnswerInput').focus();
    } catch (error) {
      showMessage(feedback, error.message || 'Impossible de charger la question de sécurité.', true);
    }
  });

  document.getElementById('verifySecurityAnswerBtn').addEventListener('click', async () => {
    if (updateLockout()) {
      showMessage(recoveryFeedback, 'La vérification est temporairement bloquée. Réessayez dans une minute.', true);
      return;
    }
    try {
      securitySettings = window.RjmAuth.getSecuritySettings();
      const answer = window.RjmCrypto.normalizeAnswer(document.getElementById('securityAnswerInput').value);
      const answerHash = await window.RjmCrypto.sha256(answer);
      if (!answer || answerHash !== securitySettings.security_answer_hash) {
        recordFailedAttempt('Réponse incorrecte.');
        return;
      }
      clearAttempts();
      recoveryFeedback.hidden = true;
      recoveryForm.hidden = false;
      document.getElementById('newAdminPassword').focus();
    } catch (error) {
      showMessage(recoveryFeedback, error.message || 'Impossible de vérifier la réponse.', true);
    }
  });

  recoveryForm.addEventListener('submit', async event => {
    event.preventDefault();
    const newPassword = document.getElementById('newAdminPassword').value;
    const confirmation = document.getElementById('confirmAdminPassword').value;
    if (!meetsPasswordPolicy(newPassword)) {
      showMessage(recoveryFeedback, 'Choisissez au moins 12 caractères avec une majuscule, une minuscule, un chiffre et un symbole.', true);
      return;
    }
    if (newPassword !== confirmation) {
      showMessage(recoveryFeedback, 'Les deux mots de passe ne correspondent pas.', true);
      return;
    }

    try {
      securitySettings.password_hash = await window.RjmCrypto.sha256(newPassword);
      securitySettings.is_default_password = false;
      securitySettings.last_password_change = new Date().toISOString();
      window.RjmAuth.saveSecuritySettings(securitySettings);
      clearAttempts();
      window.RjmAuth.setUser({
        role: 'admin',
        nom: securitySettings.identifiant,
        identifiant: securitySettings.identifiant
      });
      await redirectToDashboard();
    } catch (error) {
      showMessage(recoveryFeedback, error.message || 'Le nouveau mot de passe n’a pas pu être enregistré.', true);
    }
  });

  document.getElementById('closeRecoveryBtn').addEventListener('click', () => {
    recovery.hidden = true;
    recoveryFeedback.hidden = true;
  });

  if (new URLSearchParams(window.location.search).get('expire') === '1') {
    document.getElementById('sessionExpireAlert').hidden = false;
  }
});
