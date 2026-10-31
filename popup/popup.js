import {
  findWhitelistMatch,
  getDomain,
  normalizeDomain,
  normalizeUrl,
} from "../shared/domain.js";
import { createView } from "./view.js";

if (chrome.extension.getViews({ type: "popup" }).includes(window))
  document.documentElement.classList.add("toolbar-popup");

const state = {
  initialTab: null,
  displayedTarget: null,
  requestToken: 0,
  stateToken: 0,
  historyMutationToken: 0,
  data: { whitelist: [], history: [], stats: {} },
};
const $ = (id) => document.getElementById(id);
const view = createView($, state);

function send(command) {
  return new Promise((resolve) =>
    chrome.runtime.sendMessage(command, (response) => {
      const runtimeError = chrome.runtime.lastError;
      resolve(
        runtimeError
          ? {
              ok: false,
              error: {
                code: "RUNTIME_ERROR",
                message: "Nije moguće povezati se s proširenjem.",
              },
            }
          : response,
      );
    }),
  );
}

function showError(message) {
  $("errorBanner").textContent = message;
  $("errorBanner").hidden = false;
}

async function refreshState() {
  const token = ++state.stateToken;
  const response = await send({ type: "GET_STATE" });
  if (token !== state.stateToken) return;
  if (!response?.ok)
    return showError(
      response?.error?.message || "Nije moguće učitati podatke.",
    );
  state.data = response.state;
  view.renderHistory(state.data.history || []);
  view.renderSettings(state.data);
  reconcileDisplayedWhitelist("state-refresh");
}

async function requestCheck(
  target,
  { updateBadge = false, forceCheck = false } = {},
) {
  if (!target) return;
  const token = ++state.requestToken;
  state.displayedTarget = target;
  state.lastVerdict = "checking";
  view.showChecking(target.domain);
  const result = await send({
    type: "CHECK_URL",
    url: target.url,
    forceCheck,
    tabId: target.tabId,
    updateBadge,
  });
  if (token !== state.requestToken) return;
  if (!result?.verdict) {
    view.showStatus(
      {
        verdict: "error",
        message:
          result?.error?.message ||
          "Servis CERT iffy trenutačno nije dostupan. Pokušajte ponovno.",
      },
      target.domain,
    );
    if (target.kind === "manual") scrollToResult();
    return;
  }
  view.showStatus(result, target.domain);
  if (result.persistenceWarning)
    showError("Provjera je dovršena, ali rezultat nije spremljen u povijest.");
  else if (result.errorCode === "STORAGE_ERROR")
    showError(result.message || "Pogreška pri spremanju rezultata provjere.");
  else $("errorBanner").hidden = true;
  if (target.kind === "manual" && result.verdict !== "error")
    $("manualCheckInput").value = "";
  if (target.kind === "manual") scrollToResult();
}

function scrollToResult() {
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  $("shieldCard").scrollIntoView({ behavior, block: "start" });
}

function reconcileDisplayedWhitelist(action) {
  const target = state.displayedTarget;
  if (!target) return;
  const entry = findWhitelistMatch(target.domain, state.data.whitelist);
  if (entry) {
    ++state.requestToken;
    view.showStatus(
      { verdict: "whitelisted", domain: target.domain, whitelistEntry: entry },
      target.domain,
    );
  } else if (
    (action === "remove" || action === "state-refresh") &&
    state.lastVerdict === "whitelisted"
  ) {
    requestCheck(target, {
      updateBadge: target.kind === "tab",
      forceCheck: target.kind === "tab",
    });
  }
}

document.querySelectorAll(".nav-btn").forEach((button) =>
  button.addEventListener("click", () => {
    activateTab(button);
  }),
);

function activateTab(selected) {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    const active = button === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.id === selected.dataset.tab;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  $("contentContainer").scrollTop = 0;
  refreshState();
}

document.querySelector(".nav-bar").addEventListener("keydown", (event) => {
  const tabs = [...document.querySelectorAll(".nav-btn")];
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  let next;
  if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
  else if (event.key === "ArrowLeft")
    next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  else return;
  event.preventDefault();
  activateTab(tabs[next]);
  tabs[next].focus();
});

$("btnRefreshCheck").addEventListener("click", () => {
  const target = state.displayedTarget;
  if (target)
    requestCheck(target, {
      updateBadge: target.kind === "tab",
      forceCheck: true,
    });
});

$("btnWhitelistCurrent").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const target = state.displayedTarget;
  const targetToken = state.requestToken;
  const action = button.dataset.action;
  if (action === "add" && state.lastVerdict === "warning") {
    const accepted = confirm(
      "CERT iffy je prijavio ovu domenu. Za ovu domenu i njezine poddomene preskočit će se buduće provjere i upozorenja. Zanemariti prijavu i dodati u dozvoljene?",
    );
    if (
      !accepted ||
      target !== state.displayedTarget ||
      targetToken !== state.requestToken
    )
      return;
  }
  const domain =
    action === "remove"
      ? button.dataset.entry || target?.domain
      : target?.domain;
  if (!domain) return;
  const response = await send({
    type: action === "add" ? "ADD_WHITELIST" : "REMOVE_WHITELIST",
    domain,
  });
  if (!response?.ok)
    return showError(
      response?.error?.message || "Nije moguće ažurirati popis dozvoljenih.",
    );
  ++state.stateToken;
  state.data = response.state;
  view.renderSettings(state.data);
  if (target === state.displayedTarget && targetToken === state.requestToken)
    reconcileDisplayedWhitelist(action);
});

$("btnClearHistory").addEventListener("click", async () => {
  if (!confirm("Poništiti svu povijest provjera?")) return;
  const token = ++state.historyMutationToken;
  const response = await send({ type: "CLEAR_HISTORY" });
  if (token !== state.historyMutationToken) return refreshState();
  if (response?.ok) {
    ++state.stateToken;
    state.data = response.state;
    view.renderHistory(state.data.history);
    state.undoToken = null;
    $("undoNotice").hidden = true;
  } else
    showError(response?.error?.message || "Nije moguće očistiti povijest.");
});

$("historyList").addEventListener("click", async (event) => {
  const button = event.target.closest(".btn-delete-history");
  if (!button) return;
  const token = ++state.historyMutationToken;
  const response = await send({
    type: "DELETE_HISTORY",
    id: button.dataset.id,
  });
  if (token !== state.historyMutationToken) return refreshState();
  if (response?.ok) {
    ++state.stateToken;
    state.data = response.state;
    view.renderHistory(state.data.history);
    state.undoToken = response.undoToken || null;
    $("undoNotice").hidden = !state.undoToken;
    if (state.undoToken) $("undoMessage").textContent = "Zapis je uklonjen.";
  } else showError(response?.error?.message || "Nije moguće ukloniti zapis.");
});

$("btnUndoDelete").addEventListener("click", async () => {
  if (!state.undoToken) return;
  const token = state.undoToken;
  const mutationToken = ++state.historyMutationToken;
  const response = await send({ type: "RESTORE_HISTORY", undoToken: token });
  if (mutationToken !== state.historyMutationToken) return refreshState();
  if (!response?.ok) {
    if (state.undoToken === token) {
      state.undoToken = null;
      $("undoNotice").hidden = true;
    }
    return showError(response?.error?.message || "Nije moguće vratiti zapis.");
  }
  ++state.stateToken;
  state.undoToken = null;
  $("undoNotice").hidden = true;
  state.data = response.state;
  view.renderHistory(state.data.history);
});

$("whitelistList").addEventListener("click", async (event) => {
  const button = event.target.closest(".btn-remove-whitelist");
  if (!button) return;
  const response = await send({
    type: "REMOVE_WHITELIST",
    domain: button.dataset.domain,
  });
  if (!response?.ok)
    return showError(
      response?.error?.message || "Nije moguće ukloniti domenu.",
    );
  ++state.stateToken;
  state.data = response.state;
  view.renderSettings(state.data);
  reconcileDisplayedWhitelist("remove");
});

$("manualCheckForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("manualCheckInput").value.trim();
  const domain = getDomain(value);
  if (!domain) {
    ++state.requestToken;
    state.displayedTarget = null;
    view.showStatus({
      verdict: "error",
      message: "Unesite valjanu HTTP(S) adresu ili naziv domene.",
    });
    return;
  }
  const url = normalizeUrl(value);
  requestCheck({
    url,
    domain,
    tabId: state.initialTab?.tabId ?? null,
    kind: "manual",
  });
});

$("whitelistAddForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const domain = normalizeDomain($("whitelistAddInput").value);
  if (!domain) return showError("Unesite valjanu domenu.");
  const response = await send({ type: "ADD_WHITELIST", domain });
  if (!response?.ok)
    return showError(response?.error?.message || "Nije moguće dodati domenu.");
  ++state.stateToken;
  state.data = response.state;
  view.renderSettings(state.data);
  $("whitelistAddInput").value = "";
  reconcileDisplayedWhitelist("add");
});

$("rowAbout").addEventListener("click", () => chrome.runtime.openOptionsPage());

async function initialize() {
  const startupToken = state.requestToken;
  await refreshState();
  if (state.requestToken !== startupToken) return;

  const requestedUrl = new URLSearchParams(window.location.search).get("check");
  if (requestedUrl !== null) {
    const url = normalizeUrl(requestedUrl);
    if (!url) {
      view.showStatus({
        verdict: "error",
        message:
          "Poveznica iz kontekstnog izbornika nije valjana HTTP(S) adresa.",
      });
      return;
    }
    requestCheck({ url, domain: getDomain(url), tabId: null, kind: "manual" });
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (state.requestToken !== startupToken) return;
    const tab = tabs[0];
    if (!tab?.url)
      return view.showStatus(
        {
          verdict: "error",
          message: "Nije moguće pročitati URL trenutne kartice.",
        },
        "Nepoznato",
      );
    if (!/^https?:/i.test(tab.url))
      return view.showInternal(getDomain(tab.url));
    state.initialTab = {
      url: tab.url,
      domain: getDomain(tab.url),
      tabId: tab.id,
      kind: "tab",
    };
    requestCheck(state.initialTab, { updateBadge: true, forceCheck: false });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (changes.whitelist || changes.history || changes.stats)
  )
    refreshState();
});

initialize();
