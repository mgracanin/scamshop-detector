const icons = {
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-symbol"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-symbol"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="status-symbol"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="trash-icon"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
};

const statuses = {
  safe: {
    className: "status-info",
    icon: "info",
    title: "Nema zabilježenih prijava",
    message:
      "CERT iffy nije prepoznao domenu na popisu prijavljenih lažnih trgovina.",
    tips: false,
    action: "add",
  },
  warning: {
    className: "status-warning",
    icon: "warning",
    title: "Upozorenje: Obilježja lažne trgovine!",
    message:
      "CERT iffy je pronašao ovu domenu u popisu prijavljenih lažnih trgovina.",
    tips: true,
    action: "add",
  },
  whitelisted: {
    className: "status-whitelisted",
    icon: "star",
    title: "Dozvoljena domena",
    message: "Domena se nalazi na vašem korisničkom popisu dozvoljenih adresa.",
    tips: false,
    action: "remove",
  },
  error: {
    className: "status-error",
    icon: "info",
    title: "Pogreška pri provjeri",
    message:
      "Servis CERT iffy trenutačno nije dostupan. Provjerite vezu i pokušajte ponovno.",
    tips: false,
    action: null,
  },
};

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function createView($, state) {
  function showStatus(result, targetDomain = "") {
    state.lastVerdict = result.verdict;
    const config = statuses[result.verdict] || statuses.error;
    const card = $("shieldCard");
    card.className = `shield-card ${config.className}`;
    card.setAttribute("aria-busy", "false");
    $("shieldOverlay").innerHTML = icons[config.icon];
    $("statusVerdict").textContent = config.title;
    $("statusDomain").textContent =
      result.domain || targetDomain || "Nepoznato";
    const errorCopy = {
      INVALID_URL: "Unesite valjanu HTTP(S) adresu ili naziv domene.",
      NETWORK_ERROR:
        "Provjera nije uspjela zbog problema s vezom. Provjerite vezu i pokušajte ponovno.",
      HTTP_ERROR:
        "Servis CERT iffy trenutačno ne odgovara. Pokušajte ponovno kasnije.",
      INVALID_RESPONSE:
        "Od servisa CERT iffy stigao je neispravan odgovor. Pokušajte ponovno kasnije.",
      INVALID_REQUEST:
        "Servis nije mogao provjeriti ovu adresu. Provjerite adresu i pokušajte ponovno.",
      TIMEOUT: "Odgovor servisa kasni. Pokušajte ponovno kasnije.",
      SESSION_EXPIRED:
        "Servis CERT iffy trenutačno ne prihvaća zahtjev. Pokušajte ponovno kasnije.",
      STORAGE_ERROR:
        "Rezultat provjere nije se mogao spremiti. Pokušajte ponovno.",
    };
    const technical = result.errorCode
      ? `${result.errorCode}: ${result.message || "Bez dodatnih informacija."}`
      : "";
    $("statusDescription").textContent =
      result.verdict === "error"
        ? errorCopy[result.errorCode] ||
          (result.errorCode ? config.message : result.message || config.message)
        : config.message;
    $("errorDetails").hidden = !technical;
    $("errorTechnical").textContent = technical;
    $("statusCaveat").hidden = result.verdict !== "safe";
    $("warningAdvice").hidden = result.verdict !== "warning";
    $("meaningDetails").hidden = !["safe", "warning"].includes(result.verdict);
    $("tipsActionArea").style.display = config.tips ? "block" : "none";
    $("safetyActionRow").style.display = state.displayedTarget
      ? "flex"
      : "none";
    $("btnWhitelistCurrent").style.display = config.action
      ? "inline-flex"
      : "none";
    if (config.action) {
      const button = $("btnWhitelistCurrent");
      button.dataset.action = config.action;
      button.dataset.entry = result.whitelistEntry || targetDomain;
      button.innerHTML = `${config.action === "add" ? icons.star : icons.close} <span>${config.action === "add" ? "Dodaj u dozvoljene" : "Ukloni iz dozvoljenih"}</span>`;
    }
  }

  function showChecking(domain) {
    $("shieldCard").className = "shield-card status-checking";
    $("shieldCard").setAttribute("aria-busy", "true");
    $("shieldOverlay").innerHTML = '<div class="spinner"></div>';
    $("statusVerdict").textContent = "Provjera u bazi CERT iffy...";
    $("statusDomain").textContent = domain;
    $("statusDescription").textContent =
      "Uspoređivanje domene s bazom prijavljenih lažnih trgovina...";
    $("errorDetails").hidden = true;
    $("tipsActionArea").style.display = "none";
    $("safetyActionRow").style.display = "none";
    $("statusCaveat").hidden = true;
    $("warningAdvice").hidden = true;
    $("meaningDetails").hidden = true;
  }

  function showInternal(domain) {
    $("shieldCard").className = "shield-card status-paused";
    $("shieldCard").setAttribute("aria-busy", "false");
    $("shieldOverlay").innerHTML = icons.info;
    $("statusVerdict").textContent = "Interna stranica";
    $("statusDomain").textContent = domain || "Lokalno";
    $("statusDescription").textContent =
      "Ovo je interna adresa preglednika (provjera u bazi internetskih trgovina nije primjenjiva).";
    $("errorDetails").hidden = true;
    $("statusCaveat").hidden = true;
    $("warningAdvice").hidden = true;
    $("meaningDetails").hidden = true;
    $("tipsActionArea").style.display = "none";
    $("safetyActionRow").style.display = "none";
  }

  function renderHistory(history) {
    const list = $("historyList");
    list.replaceChildren();
    $("historyEmptyState").style.display = history.length ? "none" : "flex";
    const badges = {
      safe: ["hist-badge-green", "OK"],
      warning: ["hist-badge-red", "⚠"],
      whitelisted: ["hist-badge-blue", "★"],
    };
    const dateGroups = new Map();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const yesterday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 1,
    );
    const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
    for (const item of history) {
      const date = new Date(item.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!dateGroups.has(key)) dateGroups.set(key, { date, items: [] });
      dateGroups.get(key).items.push(item);
    }
    for (const [key, group] of dateGroups) {
      const heading = document.createElement("li");
      heading.className = "history-date-group";
      heading.textContent =
        key === todayKey
          ? "Danas"
          : key === yesterdayKey
            ? "Jučer"
            : new Intl.DateTimeFormat("hr-HR", { dateStyle: "long" }).format(
                group.date,
              );
      list.appendChild(heading);
      for (const item of group.items) {
        const [badge, symbol] = badges[item.verdict] || [
          "hist-badge-gray",
          "ℹ",
        ];
        const li = document.createElement("li");
        li.className = "history-item";
        li.innerHTML = `<div class="hist-indicator ${badge}">${symbol}</div><div class="hist-content"><div class="hist-domain" title="${escapeHtml(item.url || item.domain)}">${escapeHtml(item.domain)}</div><div class="hist-time">${escapeHtml(new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</div></div><button class="btn-delete-history" data-id="${escapeHtml(item.id)}" title="Ukloni iz povijesti" aria-label="Ukloni ${escapeHtml(item.domain)} iz povijesti">${icons.trash}</button>`;
        list.appendChild(li);
      }
    }
  }

  function renderSettings({ stats = {}, whitelist = [] }) {
    $("statScanned").textContent = stats.scanned || 0;
    $("statSafe").textContent = stats.safe || 0;
    $("statWarnings").textContent = stats.warnings || 0;
    $("whitelistEmptyState").style.display = whitelist.length
      ? "none"
      : "block";
    const list = $("whitelistList");
    list.replaceChildren();
    for (const domain of whitelist) {
      const li = document.createElement("li");
      li.className = "whitelist-item";
      li.innerHTML = `<span class="whitelist-domain">${escapeHtml(domain)}</span><button class="btn-remove-whitelist" data-domain="${escapeHtml(domain)}" title="Ukloni s popisa" aria-label="Ukloni ${escapeHtml(domain)} s popisa">${icons.close}</button>`;
      list.appendChild(li);
    }
  }

  return {
    showStatus,
    showChecking,
    showInternal,
    renderHistory,
    renderSettings,
  };
}
