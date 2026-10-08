// Keyboard navigation and dialog focus management for dynamically rendered views.
const ACCESSIBILITY = {
  dialogs: new Map(),
  visible(el) {
    return (
      el.isConnected &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden"
    );
  },
  controls(el) {
    return [
      ...el.querySelectorAll(
        'button, input, select, textarea, a[href], summary, [tabindex="0"]',
      ),
    ].filter((x) => !x.disabled && this.visible(x));
  },
  refresh() {
    document.querySelector(".tabs")?.setAttribute("role", "tablist");
    document.querySelectorAll(".tabs .tab").forEach((el) => {
      const id = el.getAttribute("onclick").match(/'([^']+)'/)?.[1];
      el.setAttribute("role", "tab");
      el.tabIndex = 0;
      el.setAttribute(
        "aria-selected",
        el.classList.contains("active") ? "true" : "false",
      );
      if (id) {
        el.id ||= "nav-" + id;
        el.setAttribute("aria-controls", id);
        const panel = document.getElementById(id);
        panel?.setAttribute("role", "tabpanel");
        panel?.setAttribute("aria-labelledby", el.id);
      }
    });
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!el.labels?.length && !el.hasAttribute("aria-label"))
        el.setAttribute(
          "aria-label",
          el.placeholder || el.title || el.id || "Значение",
        );
    });
    document
      .querySelectorAll(
        '[onclick]:not(button):not(a):not(.tab):not([id$="-modal"])',
      )
      .forEach((el) => {
        if (
          ["DIV", "TR", "SPAN"].includes(el.tagName) &&
          !el.querySelector("button,input,select,[onclick]")
        ) {
          el.tabIndex = 0;
          el.setAttribute("role", "button");
        }
      });
    document.querySelectorAll("button").forEach((el) => {
      if (["✕", "×"].includes(el.textContent.trim()))
        el.setAttribute("aria-label", "Закрыть");
    });
    for (const [el, previous] of this.dialogs)
      if (!this.visible(el)) {
        this.dialogs.delete(el);
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      }
    document.querySelectorAll('[id$="-modal"]').forEach((el) => {
      if (!this.visible(el)) return;
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.tabIndex = -1;
      el.setAttribute(
        "aria-label",
        el.querySelector("h2,h3")?.textContent || "Настройки",
      );
      if (!this.dialogs.has(el)) {
        this.dialogs.set(el, document.activeElement);
        (this.controls(el)[0] ?? el).focus({ preventScroll: true });
      }
    });
  },
  topDialog() {
    return [...this.dialogs.keys()]
      .filter((el) => this.visible(el))
      .sort(
        (a, b) =>
          Number(getComputedStyle(a).zIndex) -
          Number(getComputedStyle(b).zIndex),
      )
      .at(-1);
  },
  init() {
    if (this.initialized) return;
    this.initialized = true;
    document.addEventListener("input", (e) => {
      if (e.target.matches("input[id],select[id]"))
        e.target.dataset.dirty = "1";
    });
    document.addEventListener("change", (e) => {
      if (e.target.matches("input[id],select[id]"))
        e.target.dataset.dirty = "1";
    });
    document.addEventListener("click", () =>
      queueMicrotask(() => {
        this.refresh();
        PERSISTENCE.save();
      }),
    );
    document.addEventListener("keydown", (e) => {
      const dialog = this.topDialog();
      if (e.key === "Escape") {
        if (dialog) {
          e.preventDefault();
          if (dialog.id === "store-modal") UI_DASHBOARD.closeStoreModal();
          else if (dialog.id === "market-item-modal")
            UI_DASHBOARD.closeMarketModal();
          else if (dialog.id === "bank-modal") UI_DASHBOARD.closeBankModal();
          else if (dialog.id === "b2b-sync-modal")
            dialog.style.display = "none";
          else dialog.remove();
          this.refresh();
        } else if (STATE.tutorial.isActive) TUTORIAL.skip();
        return;
      }
      if (dialog && e.key === "Tab" && !STATE.tutorial.isActive) {
        const controls = this.controls(dialog),
          first = controls[0] ?? dialog,
          last = controls.at(-1) ?? dialog;
        if (
          (e.shiftKey &&
            (document.activeElement === first ||
              !dialog.contains(document.activeElement))) ||
          (!e.shiftKey &&
            (document.activeElement === last ||
              !dialog.contains(document.activeElement)))
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
        return;
      }
      const target = e.target.closest('[role="tab"], [role="button"]');
      if (target && target === e.target && ["Enter", " "].includes(e.key)) {
        e.preventDefault();
        target.click();
      }
      if (
        target?.getAttribute("role") === "tab" &&
        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
      ) {
        const tabs = [...document.querySelectorAll(".tabs .tab")],
          idx = tabs.indexOf(target);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : (idx + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                tabs.length;
        e.preventDefault();
        tabs[next].focus();
        tabs[next].click();
      }
    });
    let scheduled = false;
    new MutationObserver(() => {
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          this.refresh();
        });
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
    const header = document.querySelector(".app-header");
    if (header)
      new ResizeObserver(() =>
        document.documentElement.style.setProperty(
          "--header-height",
          header.getBoundingClientRect().height + "px",
        ),
      ).observe(header);
    this.refresh();
  },
};
