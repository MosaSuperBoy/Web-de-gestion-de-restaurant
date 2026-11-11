(function (window) {
  'use strict';

  const Theme = {
    KEY: 'pluto_theme',
    CUSTOM_KEY: 'pluto_custom_colors_v1',
    LEGACY_KEY: 'aca_theme',
    DEFAULT: 'grege',
    VALUES: ['grege', 'ardoise', 'papier', 'nuit'],
    COLOR_PROPERTIES: {
      bg: '--bg',
      panel: '--panel',
      txt: '--txt',
      muted: '--muted',
      gold: '--gold',
      accent2: '--accent2',
      line: '--line'
    },

    init() {
      const saved = localStorage.getItem(this.KEY) || localStorage.getItem(this.LEGACY_KEY) || this.DEFAULT;
      this.apply(saved, false);
      this.applyStoredCustomColors();
      this.bindUI();
      window.addEventListener('storage', event => {
        if (event.key === this.KEY) {
          this.apply(event.newValue || this.DEFAULT, false);
          this.applyStoredCustomColors();
        }
        if (event.key === this.CUSTOM_KEY) this.applyStoredCustomColors();
      });
      if (localStorage.getItem(this.KEY) === null && localStorage.getItem(this.LEGACY_KEY) !== null) {
        localStorage.setItem(this.KEY, saved);
        localStorage.removeItem(this.LEGACY_KEY);
      }
    },

    apply(name, persist) {
      const theme = this.VALUES.includes(name) ? name : this.DEFAULT;
      Object.values(this.COLOR_PROPERTIES).forEach(property => {
        document.documentElement.style.removeProperty(property);
      });
      document.documentElement.setAttribute('data-theme', theme);
      if (persist) localStorage.removeItem(this.CUSTOM_KEY);
      document.querySelectorAll('.theme-option').forEach(button => {
        button.classList.toggle('active', button.dataset.themeVal === theme);
      });
      if (persist) localStorage.setItem(this.KEY, theme);
    },

    isValidColors(colors) {
      return colors && Object.keys(this.COLOR_PROPERTIES).every(key =>
        typeof colors[key] === 'string' && /^#[\da-f]{6}$/i.test(colors[key]));
    },

    readCustomColors() {
      let colors;
      try {
        colors = JSON.parse(localStorage.getItem(this.CUSTOM_KEY) || 'null');
      } catch (error) {
        colors = null;
      }
      if (this.isValidColors(colors)) return colors;
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(Object.entries(this.COLOR_PROPERTIES).map(([key, property]) => [
        key,
        style.getPropertyValue(property).trim()
      ]));
    },

    applyCustomColors(colors, persist) {
      if (!this.isValidColors(colors)) throw new Error('Choisissez une couleur valide pour chaque élément.');
      Object.entries(this.COLOR_PROPERTIES).forEach(([key, property]) => {
        document.documentElement.style.setProperty(property, colors[key]);
      });
      if (persist) localStorage.setItem(this.CUSTOM_KEY, JSON.stringify(colors));
    },

    applyStoredCustomColors() {
      const colors = this.readCustomColors();
      if (this.isValidColors(colors) && localStorage.getItem(this.CUSTOM_KEY)) {
        this.applyCustomColors(colors, false);
      }
    },

    bindUI() {
      const button = document.getElementById('themeToggleBtn');
      const popover = document.getElementById('themePopover');
      if (!button || !popover) return;

      const customForm = document.getElementById('customThemeForm');
      if (customForm) {
        Object.keys(this.COLOR_PROPERTIES).forEach(key => {
          const input = customForm.elements.namedItem(key);
          input.value = this.readCustomColors()[key];
          input.addEventListener('input', () => {
            const colors = Object.fromEntries(Object.keys(this.COLOR_PROPERTIES).map(name => [
              name,
              customForm.elements.namedItem(name).value
            ]));
            if (this.isValidColors(colors)) this.applyCustomColors(colors, false);
          });
        });
        customForm.addEventListener('click', event => event.stopPropagation());
        customForm.addEventListener('submit', event => {
          event.preventDefault();
          const colors = Object.fromEntries(Object.keys(this.COLOR_PROPERTIES).map(key => [
            key,
            customForm.elements.namedItem(key).value
          ]));
          try {
            localStorage.setItem(this.KEY, this.DEFAULT);
            document.documentElement.setAttribute('data-theme', this.DEFAULT);
            this.applyCustomColors(colors, true);
            document.querySelectorAll('.theme-option').forEach(option => option.classList.remove('active'));
            const feedback = customForm.querySelector('[data-theme-feedback]');
            feedback.textContent = 'Palette personnalisée enregistrée sur cet appareil.';
            feedback.style.color = 'var(--success)';
          } catch (error) {
            const feedback = customForm.querySelector('[data-theme-feedback]');
            feedback.textContent = error.message || 'Impossible d’enregistrer la palette.';
            feedback.style.color = 'var(--danger)';
          }
        });
        const resetButton = customForm.querySelector('[data-theme-reset]');
        resetButton.addEventListener('click', () => {
          this.apply(this.DEFAULT, true);
          Object.keys(this.COLOR_PROPERTIES).forEach(key => {
            customForm.elements.namedItem(key).value = this.readCustomColors()[key];
          });
          customForm.querySelector('[data-theme-feedback]').textContent = 'Couleurs de la palette Nature & crème restaurées.';
        });
      }

      button.addEventListener('click', event => {
        event.stopPropagation();
        const open = !popover.classList.contains('open');
        popover.classList.toggle('open', open);
        button.setAttribute('aria-expanded', String(open));
      });

      document.addEventListener('click', event => {
        if (!popover.contains(event.target) && event.target !== button) {
          popover.classList.remove('open');
          button.setAttribute('aria-expanded', 'false');
        }
      });

      document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
          this.apply(option.dataset.themeVal, true);
          if (customForm) {
            const colors = this.readCustomColors();
            Object.keys(this.COLOR_PROPERTIES).forEach(key => {
              customForm.elements.namedItem(key).value = colors[key];
            });
            customForm.querySelector('[data-theme-feedback]').textContent = '';
          }
          popover.classList.remove('open');
          button.setAttribute('aria-expanded', 'false');
        });
      });
    }
  };

  const Typography = {
    KEY: 'pluto_restau_jomo_font',
    LEGACY_KEY: 'caa_boutique_font_v1',
    VALUES: ['default', 'sans', 'serif', 'mono'],

    init() {
      const saved = localStorage.getItem(this.KEY) || localStorage.getItem(this.LEGACY_KEY) || 'default';
      this.apply(saved, false);
      if (localStorage.getItem(this.KEY) === null && localStorage.getItem(this.LEGACY_KEY) !== null) {
        localStorage.setItem(this.KEY, saved);
        localStorage.removeItem(this.LEGACY_KEY);
      }
    },

    apply(name, persist) {
      const font = this.VALUES.includes(name) ? name : 'default';
      document.documentElement.setAttribute('data-font', font);
      document.querySelectorAll('[data-font-selector]').forEach(select => {
        select.value = font;
      });
      if (persist) localStorage.setItem(this.KEY, font);
    }
  };

  const Crypto = {
    pureSha256(value) {
      const text = unescape(encodeURIComponent(String(value)));
      const rotate = (word, bits) => (word >>> bits) | (word << (32 - bits));
      const maxWord = 2 ** 32;
      const words = [];
      const hash = [];
      const constants = [];
      const composite = {};
      let counter = 0;

      for (let candidate = 2; counter < 64; candidate++) {
        if (composite[candidate]) continue;
        for (let index = 0; index < 313; index += candidate) composite[index] = candidate;
        hash[counter] = (Math.sqrt(candidate) * maxWord) | 0;
        constants[counter] = (candidate ** (1 / 3) * maxWord) | 0;
        counter += 1;
      }

      const bitLength = text.length * 8;
      let padded = `${text}\x80`;
      while (padded.length % 64 !== 56) padded += '\x00';
      for (let index = 0; index < padded.length; index += 1) {
        words[index >> 2] |= padded.charCodeAt(index) << ((3 - index % 4) * 8);
      }
      words[words.length] = (bitLength / maxWord) | 0;
      words[words.length] = bitLength | 0;

      for (let offset = 0; offset < words.length;) {
        const schedule = words.slice(offset, offset += 16);
        const previous = hash.slice(0);

        for (let index = 0; index < 64; index += 1) {
          const w15 = schedule[index - 15];
          const w2 = schedule[index - 2];
          const a = hash[0];
          const e = hash[4];
          const first = hash[7]
            + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25))
            + ((e & hash[5]) ^ (~e & hash[6]))
            + constants[index]
            + (schedule[index] = index < 16 ? schedule[index] : (
              schedule[index - 16]
              + (rotate(w15, 7) ^ rotate(w15, 18) ^ (w15 >>> 3))
              + schedule[index - 7]
              + (rotate(w2, 17) ^ rotate(w2, 19) ^ (w2 >>> 10))
            ) | 0);
          const second = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22))
            + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

          hash.unshift((first + second) | 0);
          hash[4] = (hash[4] + first) | 0;
          hash.pop();
        }

        for (let index = 0; index < 8; index += 1) hash[index] = (hash[index] + previous[index]) | 0;
      }

      return hash.map(word => {
        let hex = '';
        for (let shift = 3; shift >= 0; shift -= 1) {
          const byte = (word >> (8 * shift)) & 255;
          hex += `${byte < 16 ? '0' : ''}${byte.toString(16)}`;
        }
        return hex;
      }).join('');
    },

    async sha256(value) {
      const message = String(value == null ? '' : value);
      if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
        const bytes = new TextEncoder().encode(message);
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      }
      return this.pureSha256(message);
    },

    normalizeAnswer(value) {
      return String(value || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
  };

  const Auth = {
    KEY_USER: 'pluto_auth_user',
    KEY_LEGACY_USER: 'aca_auth_user',
    KEY_ADMIN_SECURITY: 'pluto_admin_security',
    KEY_LEGACY_ADMIN_SECURITY: 'aca_admin_security',
    KEY_GESTIONNAIRES: 'pluto_gestionnaires',
    KEY_LEGACY_GESTIONNAIRES: 'aca_gestionnaires',
    DEFAULT_ADMIN: {
      identifiant: 'Administrateur',
      password_hash: '982d23dd484e2be07ea736ce10fb48197e06df4b40b461e00ca43703a4836a7c',
      is_default_password: true,
      last_password_change: '2026-01-01T00:00:00.000Z',
      security_question: 'Quel est le nom de notre restaurant ?',
      security_answer_hash: 'ea0424c61edcedfd7a12c40e440df92694c3c3d92da6de0204a05e429b266182',
      inactivity_minutes: 30
    },

    getSecuritySettings() {
      const key = localStorage.getItem(this.KEY_ADMIN_SECURITY) !== null
        ? this.KEY_ADMIN_SECURITY
        : this.KEY_LEGACY_ADMIN_SECURITY;
      const raw = localStorage.getItem(key);
      if (raw === null) {
        this.saveSecuritySettings({ ...this.DEFAULT_ADMIN });
        return { ...this.DEFAULT_ADMIN };
      }

      let settings;
      try {
        settings = { ...this.DEFAULT_ADMIN, ...JSON.parse(raw) };
      } catch {
        throw new Error('Les réglages du compte administrateur sont illisibles. Restaurez votre sauvegarde.');
      }

      if (/fus[ée]e|spatiale|aéro|satellite|orbite/i.test(settings.security_question || '')) {
        settings.security_question = this.DEFAULT_ADMIN.security_question;
        settings.security_answer_hash = this.DEFAULT_ADMIN.security_answer_hash;
      }
      this.saveSecuritySettings(settings);
      if (key !== this.KEY_ADMIN_SECURITY) localStorage.removeItem(key);
      return settings;
    },

    saveSecuritySettings(settings) {
      localStorage.setItem(this.KEY_ADMIN_SECURITY, JSON.stringify(settings));
    },

    getUser() {
      const key = localStorage.getItem(this.KEY_USER) !== null ? this.KEY_USER : this.KEY_LEGACY_USER;
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      let user;
      try {
        user = JSON.parse(raw);
      } catch {
        this.logout();
        throw new Error('La session est illisible. Reconnectez-vous.');
      }
      if (!user || !['admin', 'gestionnaire'].includes(user.role)) {
        this.logout();
        return null;
      }

      const timeoutMinutes = Number(this.getSecuritySettings().inactivity_minutes) || 30;
      if (Date.now() - Number(user.lastActive || 0) > timeoutMinutes * 60 * 1000) {
        this.logout();
        return null;
      }
      if (key !== this.KEY_USER) {
        localStorage.setItem(this.KEY_USER, JSON.stringify(user));
        localStorage.removeItem(key);
      }
      return user;
    },

    setUser(user) {
      localStorage.setItem(this.KEY_USER, JSON.stringify({ ...user, lastActive: Date.now() }));
      localStorage.removeItem(this.KEY_LEGACY_USER);
    },

    touchSession() {
      const user = this.getUser();
      if (user) this.setUser(user);
    },

    logout() {
      localStorage.removeItem(this.KEY_USER);
      localStorage.removeItem(this.KEY_LEGACY_USER);
    },

    getGestionnaires() {
      const key = localStorage.getItem(this.KEY_GESTIONNAIRES) !== null
        ? this.KEY_GESTIONNAIRES
        : this.KEY_LEGACY_GESTIONNAIRES;
      const raw = localStorage.getItem(key);
      if (!raw) return [];

      let users;
      try {
        users = JSON.parse(raw);
      } catch {
        throw new Error('La liste des utilisateurs autorisés est illisible.');
      }
      if (!Array.isArray(users)) throw new Error('La liste des utilisateurs autorisés est invalide.');
      if (key !== this.KEY_GESTIONNAIRES) {
        localStorage.setItem(this.KEY_GESTIONNAIRES, JSON.stringify(users));
        localStorage.removeItem(key);
      }
      return users;
    },

    initInactivityWatcher(onExpire) {
      const updateActivity = () => this.touchSession();
      ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(eventName => {
        window.addEventListener(eventName, updateActivity, { passive: true });
      });
      window.setInterval(() => {
        if (!this.getUser()) onExpire();
      }, 15000);
    }
  };

  window.RjmTheme = Theme;
  window.RjmTypography = Typography;
  window.RjmCrypto = Crypto;
  window.RjmAuth = Auth;

  const initialize = () => {
    Theme.init();
    Typography.init();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})(window);
