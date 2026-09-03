document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.querySelector("#support-dialog");
  const openButton = document.querySelector("#support-open");
  const closeButton = document.querySelector("#support-close");
  const form = document.querySelector("#support-form");
  if (!dialog || !openButton || !closeButton || !form) return;

  const formView = document.querySelector("#support-form-view");
  const resultView = document.querySelector("#support-result");
  const status = document.querySelector("#support-status");
  const submit = document.querySelector("#support-submit");
  const submitLabel = submit.querySelector("span");
  const customAmount = document.querySelector("#support-custom-amount");
  const amountError = document.querySelector("#support-amount-error");
  const retryButton = document.querySelector("#support-retry");
  const receipt = document.querySelector("#support-receipt");
  let submitting = false;

  const openDialog = () => {
    if (!dialog.open) dialog.showModal();
  };

  const setSubmitting = (active) => {
    submitting = active;
    submit.disabled = active;
    submitLabel.textContent = active ? "Connecting to Paystack…" : "Continue to secure payment";
  };

  const setResult = ({ title, message, state = "neutral", amount, reference, retry = false, retryReference = "" }) => {
    formView.hidden = true;
    resultView.hidden = false;
    dialog.setAttribute("aria-labelledby", "support-result-title");
    dialog.setAttribute("aria-describedby", "support-result-message");
    resultView.dataset.state = state;
    document.querySelector("#support-result-title").textContent = title;
    document.querySelector("#support-result-message").textContent = message;
    document.querySelector("#support-result-label").textContent = state === "success" ? "Payment confirmed" : "Payment status";
    document.querySelector("#support-result-amount").textContent = amount || "";
    document.querySelector("#support-result-reference").textContent = reference || "";
    receipt.hidden = !(amount && reference);
    retryButton.hidden = !retry;
    retryButton.dataset.reference = retryReference;
    openDialog();
    resultView.focus();
  };

  const showForm = () => {
    resultView.hidden = true;
    formView.hidden = false;
    dialog.setAttribute("aria-labelledby", "support-title");
    dialog.setAttribute("aria-describedby", "support-description");
    status.textContent = "";
    setSubmitting(false);
    openDialog();
    document.querySelector("#support-name").focus();
  };

  const selectedAmount = () => {
    if (customAmount.value !== "") return Number(customAmount.value);
    const selected = form.querySelector("[name='support_amount']:checked");
    return selected ? Number(selected.value) : NaN;
  };

  const validateAmount = () => {
    const amount = selectedAmount();
    let message = "";
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) message = "Enter a whole KES amount.";
    else if (amount < 50) message = "The minimum support amount is KES 50.";
    else if (amount > 100000) message = "The maximum support amount is KES 100,000.";
    amountError.textContent = message;
    customAmount.setAttribute("aria-invalid", String(Boolean(message)));
    return !message;
  };

  const showFieldError = (field) => {
    const error = document.getElementById(field.getAttribute("aria-describedby"));
    if (!error) return field.validity.valid;
    let message = "";
    if (field.validity.valueMissing) message = `${field.labels[0].textContent} is required.`;
    else if (field.validity.typeMismatch) message = "Enter a valid email address.";
    else if (field.validity.tooShort) message = `Please use at least ${field.minLength} characters.`;
    else if (field.validity.tooLong) message = `Please use no more than ${field.maxLength} characters.`;
    error.textContent = message;
    field.setAttribute("aria-invalid", String(Boolean(message)));
    return !message;
  };

  openButton.addEventListener("click", showForm);
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  retryButton.addEventListener("click", () => {
    const reference = retryButton.dataset.reference;
    reference ? verifyReturnedPayment(reference) : showForm();
  });

  customAmount.addEventListener("input", () => {
    if (customAmount.value !== "") form.querySelectorAll("[name='support_amount']").forEach((radio) => { radio.checked = false; });
    validateAmount();
  });
  form.querySelectorAll("[name='support_amount']").forEach((radio) => radio.addEventListener("change", () => {
    customAmount.value = "";
    validateAmount();
  }));
  form.querySelectorAll("input[required]").forEach((field) => {
    field.addEventListener("blur", () => showFieldError(field));
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") showFieldError(field);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    const requiredFields = [...form.querySelectorAll("input[required]")];
    const fieldsValid = requiredFields.map(showFieldError).every(Boolean);
    const amountValid = validateAmount();
    if (!fieldsValid || !amountValid) {
      status.textContent = "Please correct the highlighted fields.";
      (requiredFields.find((field) => !field.validity.valid) || customAmount).focus();
      return;
    }

    setSubmitting(true);
    status.textContent = "Creating a secure Paystack transaction…";
    try {
      if (window.location.protocol === "file:") {
        throw new Error("Paystack requires a running server environment. Please run 'npm run dev' or test on your deployed website.");
      }
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.querySelector("#support-name").value.trim(),
          email: document.querySelector("#support-email").value.trim(),
          amount: selectedAmount(),
          message: document.querySelector("#support-message").value.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error || "Paystack is unavailable right now.");
      status.textContent = "Redirecting to Paystack…";
      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      let message = error instanceof Error ? error.message : "Payment could not be started. Please try again.";
      if (message === "Failed to fetch") {
        message = "Could not connect to payment server. Please ensure the dev server ('npm run dev') is running or check your internet connection.";
      }
      status.textContent = message;
      setSubmitting(false);
    }
  });

  const verifyReturnedPayment = async (reference) => {
    setResult({ title: "Checking your payment…", message: "Please wait while Paystack confirms the transaction." });
    try {
      const response = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "We could not verify this payment.");
      const formattedAmount = payload.amount ? `KES ${Number(payload.amount).toLocaleString("en-KE")}` : "";
      if (payload.status === "success" && payload.verified === true) {
        setResult({ title: "Thank you for your support!", message: "Paystack has securely confirmed your payment.", state: "success", amount: formattedAmount, reference: payload.reference });
      } else if (["pending", "processing", "ongoing", "queued"].includes(payload.status)) {
        setResult({ title: "Payment is still pending", message: "Paystack has not confirmed the payment yet. You can retry verification shortly.", reference: payload.reference, retry: true, retryReference: payload.reference });
      } else if (payload.status === "abandoned") {
        setResult({ title: "Payment was cancelled", message: "No confirmed payment was found. You can try again whenever you’re ready.", reference: payload.reference, retry: true });
      } else {
        setResult({ title: "Payment was not successful", message: "Paystack did not confirm this payment. Please try again or use a different payment method at checkout.", reference: payload.reference, retry: true });
      }
    } catch (error) {
      let message = error instanceof Error ? error.message : "We could not verify this payment.";
      if (message === "Failed to fetch") {
        message = "Could not connect to payment server. Please check your network connection or server status.";
      }
      setResult({ title: "Verification unavailable", message, reference, retry: true });
    }
  };

  const query = new URLSearchParams(window.location.search);
  const returnedReference = query.get("reference") || query.get("trxref");
  if (returnedReference) {
    verifyReturnedPayment(returnedReference);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } else if (query.get("payment") === "callback") {
    setResult({ title: "No payment reference found", message: "This page cannot confirm a payment without a valid Paystack reference.", retry: true });
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } else if (query.get("payment") === "cancelled") {
    setResult({ title: "Payment was cancelled", message: "No payment was confirmed. You can try again whenever you’re ready.", retry: true });
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  window.addEventListener("pageshow", () => setSubmitting(false));
});
