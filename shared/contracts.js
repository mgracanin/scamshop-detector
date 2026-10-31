/** @typedef {'safe'|'warning'|'error'|'whitelisted'} Verdict */
/** @typedef {{verdict: Verdict, status_code: number, message: string, domain: string, url: string, checkedAt: number, source: string, whitelistEntry?: string, errorCode?: string, persistenceWarning?: string}} CheckResult */
/** @typedef {{type: 'CHECK_URL', url: string, forceCheck?: boolean, tabId?: number, updateBadge?: boolean}} CheckCommand */
/** @typedef {{whitelist: string[], history: object[], stats: {scanned: number, safe: number, warnings: number}}} ExtensionState */
/** @typedef {{type: 'DELETE_HISTORY', id: string} | {type: 'RESTORE_HISTORY', undoToken: string} | {type: 'CLEAR_HISTORY'}} HistoryCommand */
/** @typedef {{ok: true, state: ExtensionState, undoToken: string|null}} DeleteHistoryResponse */
export {};
