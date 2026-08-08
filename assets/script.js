document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.querySelector(".mobile-menu");
  const toggleLabel = toggle?.querySelector("span");
  let lastFocused = null;

  const closeMenu = (restoreFocus = false) => {
    if (!toggle || !menu) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggleLabel.textContent = "Menu";
    document.body.classList.remove("menu-open");
    if (restoreFocus && lastFocused) lastFocused.focus();
  };

  const openMenu = () => {
    if (!toggle || !menu) return;
    lastFocused = document.activeElement;
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggleLabel.textContent = "Close";
    document.body.classList.add("menu-open");
    menu.querySelector("a")?.focus();
  };

  toggle?.addEventListener("click", () => {
    toggle.getAttribute("aria-expanded") === "true" ? closeMenu() : openMenu();
  });
  menu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") closeMenu(true);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
  });

  const navLinks = [...document.querySelectorAll(".desktop-nav a[href^='#']")];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute("href") === `#${visible.target.id}`;
          active ? link.setAttribute("aria-current", "true") : link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-25% 0px -60%", threshold: [0, 0.1, 0.4] },
    );
    sections.forEach((section) => observer.observe(section));
  }

  const form = document.querySelector(".contact-form");
  if (!form) return;
  const status = form.querySelector(".form-status");
  const submit = form.querySelector(".submit-button");
  const submitLabel = submit.querySelector("span");
  const fields = [...form.querySelectorAll("input[required], select[required], textarea[required]")];

  const messageFor = (field) => {
    if (field.validity.valueMissing) return `${field.labels[0].textContent} is required.`;
    if (field.validity.typeMismatch) return "Enter a valid email address.";
    if (field.validity.tooShort) return `Please use at least ${field.minLength} characters.`;
    return "Please check this field.";
  };

  const showError = (field) => {
    const error = document.getElementById(field.getAttribute("aria-describedby"));
    if (!error) return;
    const message = field.validity.valid ? "" : messageFor(field);
    error.textContent = message;
    field.setAttribute("aria-invalid", String(!field.validity.valid));
  };

  fields.forEach((field) => {
    field.addEventListener("blur", () => showError(field));
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") showError(field);
    });
    field.addEventListener("change", () => showError(field));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    fields.forEach(showError);
    const firstInvalid = fields.find((field) => !field.validity.valid);
    if (firstInvalid) {
      status.textContent = "Please correct the highlighted fields before sending.";
      firstInvalid.focus();
      return;
    }

    const config = window.EMAILJS_CONFIG || {};
    if (!config.serviceId || !config.templateId || !config.publicKey) {
      status.textContent = "Email delivery is not configured yet. Please contact Emmanuel by email or WhatsApp.";
      return;
    }

    const honeypot = form.querySelector("[name='_honey']");
    if (honeypot?.value.trim()) {
      status.textContent = "This enquiry could not be sent. Please contact Emmanuel directly.";
      return;
    }

    status.textContent = "Submitting your enquiry securely…";
    submit.disabled = true;
    submitLabel.textContent = "Sending…";

    const data = new FormData(form);
    const templateParams = {
      from_name: String(data.get("from_name") || ""),
      reply_to: String(data.get("reply_to") || ""),
      service: String(data.get("service") || ""),
      budget: String(data.get("budget") || "Not sure yet"),
      message: String(data.get("message") || ""),
      submitted_at: new Date().toISOString(),
      page_url: window.location.href,
    };

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: config.serviceId,
          template_id: config.templateId,
          user_id: config.publicKey,
          template_params: templateParams,
        }),
      });
      if (!response.ok) throw new Error("EmailJS rejected the enquiry.");
      status.textContent = "Your enquiry has been sent successfully. Redirecting…";
      form.reset();
      fields.forEach((field) => field.setAttribute("aria-invalid", "false"));
      form.querySelectorAll(".error").forEach((error) => { error.textContent = ""; });
      window.setTimeout(() => window.location.assign("thank-you.html"), 700);
    } catch {
      status.textContent = "Your enquiry could not be sent. Please try again or contact Emmanuel by email or WhatsApp.";
      submit.disabled = false;
      submitLabel.textContent = "Send Project Enquiry";
    }
  });

  window.addEventListener("pageshow", () => {
    submit.disabled = false;
    submitLabel.textContent = "Send Project Enquiry";
  });
});
