// In-game styled dialogs (replace the browser's native confirm/prompt/alert so
// they match the game's look).
let openCount = 0;

export function dialogOpen() {
  return openCount > 0;
}

function ensureStyles() {
  if (document.getElementById("game-dialog-style")) return;
  const s = document.createElement("style");
  s.id = "game-dialog-style";
  s.textContent = `
.gd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.62);display:flex;
  align-items:center;justify-content:center;z-index:1000;font-family:monospace;}
.gd-box{background:rgb(18,18,22);border:2px solid rgb(120,200,255);border-radius:12px;
  box-shadow:0 0 28px rgba(120,200,255,0.45);padding:26px 30px;min-width:320px;
  max-width:90vw;text-align:center;color:rgb(225,225,230);}
.gd-msg{font-size:18px;margin-bottom:18px;line-height:1.45;}
.gd-input{width:100%;box-sizing:border-box;background:rgb(10,10,12);
  border:1px solid rgb(90,90,110);border-radius:6px;color:rgb(235,235,240);
  font-family:monospace;font-size:18px;padding:10px 12px;margin-bottom:18px;outline:none;}
.gd-input:focus{border-color:rgb(120,230,160);}
.gd-row{display:flex;gap:12px;justify-content:center;}
.gd-btn{font-family:monospace;font-size:16px;padding:10px 24px;border-radius:8px;
  border:2px solid;background:transparent;cursor:pointer;transition:background .12s;}
.gd-ok{color:rgb(120,230,160);border-color:rgb(120,230,160);}
.gd-ok:hover{background:rgba(120,230,160,0.16);}
.gd-cancel{color:rgb(205,205,215);border-color:rgb(120,120,135);}
.gd-cancel:hover{background:rgba(255,255,255,0.08);}
`;
  document.head.appendChild(s);
}

function showDialog({ message, input = false, def = "", showCancel = true }) {
  ensureStyles();
  return new Promise((resolve) => {
    openCount++;

    const overlay = document.createElement("div");
    overlay.className = "gd-overlay";
    const box = document.createElement("div");
    box.className = "gd-box";

    const msg = document.createElement("div");
    msg.className = "gd-msg";
    msg.textContent = message;
    box.appendChild(msg);

    let field = null;
    if (input) {
      field = document.createElement("input");
      field.className = "gd-input";
      field.type = "text";
      field.maxLength = 16;
      field.value = def || "";
      box.appendChild(field);
    }

    const row = document.createElement("div");
    row.className = "gd-row";
    const ok = document.createElement("button");
    ok.className = "gd-btn gd-ok";
    ok.textContent = "OK";
    row.appendChild(ok);
    let cancel = null;
    if (showCancel) {
      cancel = document.createElement("button");
      cancel.className = "gd-btn gd-cancel";
      cancel.textContent = "Cancel";
      row.appendChild(cancel);
    }
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    if (field) {
      field.focus();
      field.select();
    } else {
      ok.focus();
    }

    function close(result) {
      openCount = Math.max(0, openCount - 1);
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      resolve(result);
    }
    const onOk = () => close(input ? field.value : true);
    const onCancel = () => close(input ? null : false);

    ok.addEventListener("click", onOk);
    if (cancel) cancel.addEventListener("click", onCancel);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) onCancel();
    });

    // Capture keys so they don't leak to the game (WASD / digits / Esc).
    function onKey(e) {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        onOk();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey, true);
  });
}

// Resolves true (OK) / false (Cancel).
export function gameConfirm(message) {
  return showDialog({ message, input: false });
}

// Resolves the entered string (OK) / null (Cancel).
export function gamePrompt(message, def = "") {
  return showDialog({ message, input: true, def });
}

// Resolves true when dismissed.
export function gameAlert(message) {
  return showDialog({ message, input: false, showCancel: false });
}
