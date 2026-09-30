/*
 * FlyRank Capstone — Embeddable Widget bundle (v1)
 * Loaded via: <script src=".../widget.v1.js?id=WIDGET_ID"></script>
 * Self-contained: reads its own <script> tag, fetches config, renders a form,
 * and posts submissions back — including the CORS/preflight round trip.
 */
(function () {
  var currentScript = document.currentScript;
  var scriptUrl = new URL(currentScript.src);
  var widgetId = scriptUrl.searchParams.get("id");
  var apiOrigin = scriptUrl.origin;

  if (!widgetId) {
    console.error("[flyrank-widget] Missing ?id= on the widget script tag.");
    return;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "style") node.style.cssText = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function renderForm(config, mountPoint) {
    var form = el("form", { style: "font-family: system-ui, sans-serif; max-width: 320px;" });

    if (config.title) {
      form.appendChild(el("h3", { style: "margin: 0 0 4px;" }, [config.title]));
    }
    if (config.description) {
      form.appendChild(el("p", { style: "margin: 0 0 12px; color:#555; font-size: 13px;" }, [config.description]));
    }

    config.fields.forEach(function (field) {
      var wrapper = el("div", { style: "margin-bottom: 10px;" });
      wrapper.appendChild(
        el("label", { style: "display:block; font-size: 12px; margin-bottom: 4px;" }, [
          field.label + (field.required ? " *" : ""),
        ])
      );
      var input = el("input", {
        type: field.name === "email" ? "email" : "text",
        name: field.name,
        maxlength: String(field.maxLength || 500),
        required: field.required ? "required" : null,
        style: "width:100%; padding:6px 8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;",
      });
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    });

    // Honeypot field: visually and semantically hidden from real users.
    // Bots that auto-fill every input on a page will fill this one too.
    var honeypot = el("div", { style: "position:absolute; left:-9999px; top:-9999px;", "aria-hidden": "true" }, [
      el("label", {}, ["Company website (leave blank)"]),
      el("input", { type: "text", name: "company_website", tabindex: "-1", autocomplete: "off" }),
    ]);
    form.appendChild(honeypot);

    var statusEl = el("div", { style: "margin-top: 8px; font-size: 13px;" });
    var submitBtn = el(
      "button",
      { type: "submit", style: "padding:8px 16px; border:0; border-radius:4px; background:#0f3460; color:#fff; cursor:pointer;" },
      [config.buttonText || "Submit"]
    );
    form.appendChild(submitBtn);
    form.appendChild(statusEl);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var formData = new FormData(form);
      var data = {};
      var honeypotValue = "";
      formData.forEach(function (value, key) {
        if (key === "company_website") honeypotValue = value;
        else data[key] = value;
      });

      submitBtn.disabled = true;
      statusEl.textContent = "Sending...";

      fetch(apiOrigin + "/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetId: widgetId, data: data, company_website: honeypotValue }),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { ok: res.ok, status: res.status, body: body };
          });
        })
        .then(function (result) {
          submitBtn.disabled = false;
          if (result.ok) {
            statusEl.textContent = "Thanks — you're on the list!";
            statusEl.style.color = "green";
            form.reset();
          } else {
            statusEl.textContent = (result.body && result.body.error) || "Something went wrong.";
            statusEl.style.color = "#b00020";
          }
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          statusEl.textContent = "Network error — please try again.";
          statusEl.style.color = "#b00020";
          console.error("[flyrank-widget] submission failed:", err);
        });
    });

    mountPoint.appendChild(form);
  }

  function mount(config) {
    var mountPoint = document.getElementById("flyrank-widget-" + widgetId);
    if (!mountPoint) {
      mountPoint = el("div", { id: "flyrank-widget-" + widgetId });
      currentScript.parentNode.insertBefore(mountPoint, currentScript.nextSibling);
    }
    renderForm(config, mountPoint);
  }

  fetch(apiOrigin + "/widgets/" + widgetId + "/config")
    .then(function (res) {
      if (!res.ok) throw new Error("Widget config request failed: " + res.status);
      return res.json();
    })
    .then(mount)
    .catch(function (err) {
      console.error("[flyrank-widget] Failed to load widget:", err);
    });
})();
