const STORAGE_KEY = "wifi-late-demo-v1";
const ADMIN_AUTH_KEY = "wifi-late-demo-admin-auth";
const ADMIN_USERNAME = "";
const ADMIN_PASSWORD = "";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const FORMATS = {
    A: LETTERS,
    N: DIGITS,
    AN: LETTERS + DIGITS
};
const DURATIONS = {
    day: "1 jour",
    week: "1 semaine",
    month: "1 mois"
};
function showNotice(element, message, kind) {
    element.textContent = message;
    element.className = `notice${kind ? ` notice--${kind}` : ""}`;
}

function runSafely(noticeElement, action) {
    try {
        action();
    } catch (error) {
        const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
        showNotice(noticeElement, message, "error");
    }
}

function loadState() {
    const savedState = window.localStorage.getItem(STORAGE_KEY);
    if (savedState === null) {
        return { codes: [], groups: [], managers: [], maintenance: false };
    }

    let state;
    try {
        state = JSON.parse(savedState);
    } catch {
        throw new Error("Les données locales sont illisibles. Effacez les données du site pour recommencer.");
    }

    if (!state || !Array.isArray(state.codes) || !Array.isArray(state.managers) ||
        typeof state.maintenance !== "boolean") {
        throw new Error("Les données locales sont invalides. Effacez les données du site pour recommencer.");
    }

    if (!Array.isArray(state.groups)) {
        state.groups = [];
    }
    return state;
}

function commitState(nextState) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function randomHex(byteCount) {
    const bytes = new Uint8Array(byteCount);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function randomCodeValue(codes, format, length) {
    const alphabet = FORMATS[format];
    if (!alphabet || ![5, 6, 7, 10, 12].includes(length)) {
        throw new Error("Le format ou la longueur du code n’est pas valide.");
    }

    const values = new Set(codes.map(code => code.value.toUpperCase()));
    const cutoff = Math.floor(256 / alphabet.length) * alphabet.length;
    for (let attempt = 0; attempt < 100; attempt += 1) {
        let value = "";
        while (value.length < length) {
            const bytes = new Uint8Array(length - value.length + 8);
            window.crypto.getRandomValues(bytes);
            for (const byte of bytes) {
                if (byte < cutoff) {
                    value += alphabet[byte % alphabet.length];
                    if (value.length === length) {
                        break;
                    }
                }
            }
        }
        if (!values.has(value)) {
            return value;
        }
    }

    throw new Error("Impossible de produire un code unique. Réessayez.");
}

function getExpiry(duration, createdAt = new Date()) {
    const expiry = new Date(createdAt);
    if (duration === "day") {
        expiry.setDate(expiry.getDate() + 1);
    } else if (duration === "week") {
        expiry.setDate(expiry.getDate() + 7);
    } else if (duration === "month") {
        const dayOfMonth = expiry.getDate();
        expiry.setDate(1);
        expiry.setMonth(expiry.getMonth() + 1);
        const lastDayOfMonth = new Date(expiry.getFullYear(), expiry.getMonth() + 1, 0).getDate();
        expiry.setDate(Math.min(dayOfMonth, lastDayOfMonth));
    } else {
        throw new Error("La durée sélectionnée n’est pas valide.");
    }
    return expiry.toISOString();
}

function createTicketGroup(state, config, generatedBy, count) {
    if (!FORMATS[config.format] || ![5, 6, 7, 10].includes(config.length) ||
        !DURATIONS[config.duration] || !Number.isFinite(config.amount) || config.amount < 0 ||
        !Number.isInteger(count) || count < 1 || count > 100) {
        throw new Error("Vérifiez le nombre de codes et les paramètres choisis.");
    }

    const groupId = randomHex(8);
    const createdAt = new Date();
    const group = {
        id: groupId,
        count,
        format: config.format,
        length: config.length,
        duration: config.duration,
        amount: config.amount,
        generatedBy,
        createdAt: createdAt.toISOString()
    };
    const codes = [...state.codes];
    for (let index = 0; index < count; index += 1) {
        codes.push({
            id: randomHex(8),
            value: randomCodeValue(codes, config.format, config.length),
            type: "ticket",
            generatedBy,
            groupId,
            format: config.format,
            length: config.length,
            duration: config.duration,
            amount: config.amount,
            active: true,
            createdAt: createdAt.toISOString(),
            activatedAt: null,
            expiresAt: null
        });
    }

    return {
        ...state,
        codes,
        groups: [...state.groups, group],
        ticketDefaults: { ...config }
    };
}

function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

function formatAmount(amount) {
    return new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatExpiry(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "expiration inconnue";
    }
    return `expire le ${date.toLocaleDateString("fr-FR")}`;
}

function downloadTicketGroupImage(group, codes, groupId, onError, onSuccess) {
    try {
        const width = 1200;
        const pagePadding = 48;
        const columns = 2;
        const gap = 20;
        const cardWidth = (width - pagePadding * 2 - gap) / columns;
        const cardHeight = 126;
        const rows = Math.ceil(codes.length / columns);
        const headerHeight = 220;
        const height = headerHeight + rows * (cardHeight + gap) + pagePadding;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Impossible de préparer l’image sur cet appareil.");
        }

        context.fillStyle = "#f2f5fb";
        context.fillRect(0, 0, width, height);
        context.fillStyle = "#465fdb";
        context.fillRect(0, 0, width, 14);
        context.textBaseline = "top";
        context.fillStyle = "#536fe5";
        context.font = "700 20px Segoe UI, Arial, sans-serif";
        context.fillText("WIFI LATE · TICKETS", pagePadding, 42);
        context.fillStyle = "#172033";
        context.font = "700 34px Segoe UI, Arial, sans-serif";
        context.fillText("Groupe de tickets", pagePadding, 78);

        const firstCode = codes[0];
        const duration = DURATIONS[group?.duration || firstCode.duration] || "durée inconnue";
        const format = group?.format || firstCode.format || "AN";
        const length = group?.length || firstCode.length || firstCode.value.length;
        const amount = group?.amount ?? firstCode.amount;
        const metadata = `${codes.length} code(s)  ·  ${format}  ·  ${length} caractères  ·  ${duration}${amount !== undefined ? `  ·  ${formatAmount(amount)}` : ""}`;
        context.fillStyle = "#667085";
        context.font = "500 18px Segoe UI, Arial, sans-serif";
        context.fillText(metadata, pagePadding, 132, width - pagePadding * 2);
        context.font = "400 15px Segoe UI, Arial, sans-serif";
        context.fillText(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, pagePadding, 168);

        codes.forEach((code, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = pagePadding + column * (cardWidth + gap);
            const y = headerHeight + row * (cardHeight + gap);
            context.fillStyle = "#ffffff";
            context.fillRect(x, y, cardWidth, cardHeight);
            context.strokeStyle = "#e3e8f1";
            context.lineWidth = 2;
            context.strokeRect(x, y, cardWidth, cardHeight);

            context.fillStyle = "#667085";
            context.font = "600 14px Segoe UI, Arial, sans-serif";
            context.fillText(`TICKET ${String(index + 1).padStart(2, "0")}`, x + 20, y + 16);
            context.fillStyle = "#172033";
            context.font = "700 27px Consolas, monospace";
            context.fillText(code.value, x + 20, y + 43, cardWidth - 40);

            let detail = `Montant : ${formatAmount(code.amount ?? amount ?? 0)}`;
            if (code.expiresAt) {
                detail += `  ·  ${formatExpiry(code.expiresAt)}`;
            } else {
                detail += `  ·  valable ${DURATIONS[code.duration || group?.duration] || duration} après activation`;
            }
            if (!code.active) {
                detail += "  ·  désactivé";
            }
            context.fillStyle = code.active ? "#536fe5" : "#b42318";
            context.font = "500 14px Segoe UI, Arial, sans-serif";
            context.fillText(detail, x + 20, y + 88, cardWidth - 40);
        });

        canvas.toBlob(blob => {
            if (!blob) {
                onError(new Error("La création de l’image a échoué. Réessayez."));
                return;
            }

            const link = document.createElement("a");
            const objectUrl = URL.createObjectURL(blob);
            link.href = objectUrl;
            link.download = `tickets-${String(groupId).slice(0, 8)}.png`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            onSuccess();
        }, "image/png");
    } catch (error) {
        onError(error);
    }
}

function setupLoginPage() {
    const form = document.getElementById("login-form");
    if (!form) {
        return;
    }

    const notice = document.getElementById("login-notice");
    const maintenanceNotice = document.getElementById("maintenance-notice");
    const codeInput = document.getElementById("ticket-code");
    const submitButton = form.querySelector('button[type="submit"]');

    function syncMaintenance(state) {
        maintenanceNotice.hidden = !state.maintenance;
        codeInput.disabled = state.maintenance;
        submitButton.disabled = state.maintenance;
    }

    try {
        syncMaintenance(loadState());
    } catch (error) {
        showNotice(notice, error.message, "error");
        codeInput.disabled = true;
        submitButton.disabled = true;
        return;
    }

    form.addEventListener("submit", event => {
        event.preventDefault();
        runSafely(notice, () => {
            const state = loadState();
            syncMaintenance(state);

            if (state.maintenance) {
                showNotice(notice, "Connexion impossible : le service est en maintenance.", "error");
                return;
            }

            const enteredCode = codeInput.value.trim().toUpperCase();
            let code = state.codes.find(item => item.active && item.value.toUpperCase() === enteredCode);
            if (!code) {
                showNotice(notice, "Code invalide. Vérifiez le code et réessayez.", "error");
                return;
            }

            if (code.expiresAt && Date.now() >= new Date(code.expiresAt).getTime()) {
                showNotice(notice, "Ce code a expiré.", "error");
                return;
            }

            if (code.type === "manager") {
                showNotice(notice, "Ce code est réservé à un gestionnaire et ne peut pas être utilisé dans l’espace client.", "error");
                return;
            }

            const firstUse = code.type === "ticket" && !code.activatedAt;
            if (firstUse) {
                const activatedAt = new Date();
                const nextState = {
                    ...state,
                    codes: state.codes.map(item => item.id === code.id
                        ? {
                            ...item,
                            activatedAt: activatedAt.toISOString(),
                            expiresAt: getExpiry(item.duration, activatedAt)
                        }
                        : item)
                };
                commitState(nextState);
                code = nextState.codes.find(item => item.id === code.id);
            }

            showNotice(
                notice,
                firstUse
                    ? `Connexion réussie. La durée de ${DURATIONS[code.duration] || "validité"} commence maintenant.`
                    : "Connexion réussie",
                "success"
            );
        });
    });
}

function setupAdminPage() {
    const batchForm = document.getElementById("ticket-batch-form");
    if (!batchForm) {
        return;
    }

    const notice = document.getElementById("admin-notice");
    const adminLoginForm = document.getElementById("admin-login-form");
    const adminLoginPanel = document.getElementById("admin-login-panel");
    const adminDashboard = document.getElementById("admin-dashboard");
    const logoutButton = document.getElementById("admin-logout");
    const codeList = document.getElementById("code-list");
    const managerList = document.getElementById("manager-list");
    const managerForm = document.getElementById("manager-form");
    const maintenanceButton = document.getElementById("maintenance-button");
    let state;

    try {
        state = loadState();
        const authenticated = window.sessionStorage.getItem(ADMIN_AUTH_KEY) === "true";
        adminLoginPanel.hidden = authenticated;
        adminDashboard.hidden = !authenticated;
    } catch (error) {
        showNotice(notice, error.message, "error");
        batchForm.querySelector('button[type="submit"]').disabled = true;
        managerForm.querySelector('button[type="submit"]').disabled = true;
        maintenanceButton.disabled = true;
        return;
    }

    adminLoginForm.addEventListener("submit", event => {
        event.preventDefault();
        runSafely(notice, () => {
            const username = document.getElementById("admin-username").value.trim();
            const password = document.getElementById("admin-password").value;
            if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
                showNotice(notice, "Connexion admin non configurée dans cette copie. Configurez une authentification côté serveur.", "error");
                return;
            }
            if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
                showNotice(notice, "Identifiant ou mot de passe incorrect.", "error");
                return;
            }

            window.sessionStorage.setItem(ADMIN_AUTH_KEY, "true");
            adminLoginForm.reset();
            adminLoginPanel.hidden = true;
            adminDashboard.hidden = false;
            showNotice(notice, "Connexion administrateur réussie.", "success");
        });
    });

    logoutButton.addEventListener("click", () => {
        runSafely(notice, () => {
            window.sessionStorage.removeItem(ADMIN_AUTH_KEY);
            adminDashboard.hidden = true;
            adminLoginPanel.hidden = false;
            showNotice(notice, "Vous êtes déconnecté.", "success");
        });
    });

    function renderCodes() {
        codeList.replaceChildren();
        if (state.codes.length === 0) {
            codeList.append(createElement("li", "item-meta", "Aucun code généré."));
            return;
        }

        const groupMap = new Map(state.groups.map(group => [group.id, group]));
        const entries = new Map();
        for (const code of state.codes) {
            const key = code.groupId || code.id;
            if (!entries.has(key)) {
                entries.set(key, { group: groupMap.get(key), codes: [] });
            }
            entries.get(key).codes.push(code);
        }

        for (const [groupId, entry] of entries) {
            const { group, codes } = entry;
            const groupItem = createElement("li", "code-group");
            let summary;
            if (group) {
                const duration = DURATIONS[group.duration] || "durée inconnue";
                summary = `${codes.length} code(s) · ${group.format} · ${group.length} caractères · ${duration} · ${formatAmount(group.amount)} · ${group.generatedBy}`;
            } else if (codes[0].type === "manager") {
                const manager = state.managers.find(item => item.id === codes[0].managerId);
                summary = `Code d’accès gestionnaire${manager ? ` · ${manager.name}` : ""}`;
            } else if (codes[0].type === "ticket") {
                summary = `Ticket${codes[0].generatedBy ? ` · ${codes[0].generatedBy}` : ""}`;
            } else {
                summary = "Code de connexion";
            }
            groupItem.append(createElement("p", "code-group-heading", summary));
            if (codes.some(code => code.type === "ticket")) {
                const downloadButton = createElement("button", "item-action", "Télécharger le groupe en image");
                downloadButton.type = "button";
                downloadButton.addEventListener("click", () => {
                    downloadTicketGroupImage(group, codes, groupId, error => {
                        const message = error instanceof Error ? error.message : "Le téléchargement de l’image a échoué.";
                        showNotice(notice, message, "error");
                    }, () => {
                        showNotice(notice, "Image du groupe téléchargée en PNG.", "success");
                    });
                });
                groupItem.append(downloadButton);
            }

            const nestedList = createElement("ul", "item-list");
            nestedList.setAttribute("aria-label", `Codes du groupe ${groupId}`);
            for (const code of codes) {
                const row = createElement("li", "item-row");
                const details = createElement("div", "item-details");
                details.append(createElement("strong", "", code.value));
                const meta = [];
                if (code.expiresAt) {
                    meta.push(formatExpiry(code.expiresAt));
                } else if (code.type === "ticket") {
                    meta.push(`Démarre à la première connexion · ${DURATIONS[code.duration] || "durée inconnue"}`);
                }
                if (code.amount !== undefined) {
                    meta.push(`Montant : ${formatAmount(code.amount)}`);
                }
                if (!code.active) {
                    meta.push("désactivé");
                }
                details.append(createElement("span", "item-meta", meta.join(" · ") || "Sans expiration"));
                row.append(details);

                const actions = createElement("div", "item-actions");
                if (code.active) {
                    const revokeButton = createElement("button", "item-action", "Désactiver");
                    revokeButton.type = "button";
                    revokeButton.addEventListener("click", () => {
                        runSafely(notice, () => {
                            const nextState = {
                                ...state,
                                codes: state.codes.map(item =>
                                    item.id === code.id ? { ...item, active: false } : item)
                            };
                            commitState(nextState);
                            state = nextState;
                            renderCodes();
                            showNotice(notice, "Code désactivé.", "success");
                        });
                    });
                    actions.append(revokeButton);
                }
                const deleteButton = createElement("button", "item-action item-action-danger", "Supprimer");
                deleteButton.type = "button";
                deleteButton.addEventListener("click", () => {
                    if (!window.confirm(`Supprimer définitivement le code ${code.value} ?`)) {
                        return;
                    }

                    runSafely(notice, () => {
                        const nextState = {
                            ...state,
                            codes: state.codes.filter(item => item.id !== code.id)
                        };
                        commitState(nextState);
                        state = nextState;
                        renderCodes();
                        renderManagers();
                        showNotice(notice, "Code supprimé.", "success");
                    });
                });
                actions.append(deleteButton);
                row.append(actions);
                nestedList.append(row);
            }
            groupItem.append(nestedList);
            codeList.append(groupItem);
        }
    }

    function renderManagers() {
        managerList.replaceChildren();
        if (state.managers.length === 0) {
            managerList.append(createElement("li", "item-meta", "Aucun gestionnaire ajouté."));
            return;
        }

        state.managers.forEach(manager => {
            const row = createElement("li", "item-row");
            const details = createElement("div", "item-details");
            details.append(createElement("strong", "", manager.name));
            const accessCode = state.codes.find(code => code.id === manager.accessCodeId && code.active);
            details.append(createElement(
                "span",
                "item-meta",
                `${manager.canGenerateTickets ? "Peut" : "Ne peut pas"} générer des tickets${accessCode ? ` · Code : ${accessCode.value}` : ""}`
            ));
            row.append(details);

            const permissionButton = createElement(
                "button",
                "item-action",
                manager.canGenerateTickets ? "Retirer le droit" : "Accorder le droit"
            );
            permissionButton.type = "button";
            permissionButton.addEventListener("click", () => {
                runSafely(notice, () => {
                    const nextState = {
                        ...state,
                        managers: state.managers.map(item =>
                            item.id === manager.id
                                ? { ...item, canGenerateTickets: !item.canGenerateTickets }
                                : item)
                    };
                    commitState(nextState);
                    state = nextState;
                    renderManagers();
                    showNotice(notice, "Droits du gestionnaire mis à jour.", "success");
                });
            });
            row.append(permissionButton);
            managerList.append(row);
        });
    }

    function renderMaintenance() {
        maintenanceButton.textContent = state.maintenance
            ? "Désactiver la maintenance"
            : "Activer la maintenance";
        maintenanceButton.setAttribute("aria-pressed", String(state.maintenance));
    }

    batchForm.addEventListener("submit", event => {
        event.preventDefault();
        runSafely(notice, () => {
            const count = Number(document.getElementById("ticket-count").value);
            const config = {
                format: document.getElementById("ticket-format").value,
                length: Number(document.getElementById("ticket-length").value),
                duration: document.getElementById("ticket-duration").value,
                amount: Number(document.getElementById("ticket-amount").value)
            };
            const nextState = createTicketGroup(state, config, "Administrateur", count);
            commitState(nextState);
            state = nextState;
            renderCodes();
            showNotice(notice, `${count} code(s) généré(s) aléatoirement.`, "success");
        });
    });

    managerForm.addEventListener("submit", event => {
        event.preventDefault();
        runSafely(notice, () => {
            const nameInput = document.getElementById("manager-name");
            const name = nameInput.value.trim();
            if (!name) {
                showNotice(notice, "Saisissez le nom du gestionnaire.", "error");
                return;
            }

            const id = randomHex(8);
            const managerCode = {
                id: randomHex(8),
                value: randomCodeValue(state.codes, "AN", 12),
                type: "manager",
                managerId: id,
                active: true,
                createdAt: new Date().toISOString()
            };
            const manager = {
                id,
                name,
                canGenerateTickets: document.getElementById("manager-ticket-right").checked,
                accessCodeId: managerCode.id
            };
            const nextState = {
                ...state,
                codes: [...state.codes, managerCode],
                managers: [...state.managers, manager]
            };
            commitState(nextState);
            state = nextState;
            managerForm.reset();
            renderManagers();
            renderCodes();
            showNotice(notice, `Gestionnaire ajouté. Son code d’accès est affiché dans la liste.`, "success");
        });
    });

    maintenanceButton.addEventListener("click", () => {
        runSafely(notice, () => {
            const nextState = { ...state, maintenance: !state.maintenance };
            commitState(nextState);
            state = nextState;
            renderMaintenance();
            showNotice(
                notice,
                state.maintenance ? "Mode maintenance activé." : "Mode maintenance désactivé.",
                "success"
            );
        });
    });

    renderCodes();
    renderManagers();
    renderMaintenance();
}

setupLoginPage();
setupAdminPage();
