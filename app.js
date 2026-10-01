import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (selector) => document.querySelector(selector);
const configReady = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
let auth, db, currentPayment;

// EXACT VERIFIED SETTINGS
const paymentSettings = { upiId: "samtiwari06@axl", qrPath: "./qr.png" };
let isSigningUp = false;

const form = $("#enrollment-form");
const paymentStep = $("#payment-step");
const loginModal = $("#login-modal");
const dashboard = $("#dashboard-screen");
const ENROLLMENT_DRAFT_KEY = "disastudy-draft-v2";
const enrollmentDraftFields = ["name", "mobile", "email", "city", "education", "goal"];

function buildUpiUri() {
  const params = {
    pa: paymentSettings.upiId,
    pn: "Disa Study",
    am: "799.00",
    cu: "INR",
    tn: "Disa Study Fee"
  };
  return `upi://pay?${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

function renderPaymentOptions() {
  const uri = buildUpiUri();
  ["#pay-upi", "#resume-pay-upi"].forEach((selector) => {
    const link = $(selector);
    if (link) link.href = uri;
  });

  // Use local qr.png directly, with smart fallback to live QR generator if file missing
  ["#payment-qr", "#resume-payment-qr"].forEach((selector) => {
    const image = $(selector);
    if (image) {
      image.src = paymentSettings.qrPath;
      image.onerror = () => {
        image.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(uri)}`;
      };
    }
  });

  document.querySelectorAll(".upi-id").forEach((node) => {
    node.textContent = paymentSettings.upiId;
  });
}

$("#year").textContent = new Date().getFullYear();
renderPaymentOptions();

// MOBILE DRAWER HANDLERS
$("#drawer-toggle")?.addEventListener("click", () => $("#mobile-drawer")?.classList.add("active"));
$("#drawer-close")?.addEventListener("click", () => $("#mobile-drawer")?.classList.remove("active"));
document.querySelectorAll(".drawer-item").forEach((el) => {
  el.addEventListener("click", () => $("#mobile-drawer")?.classList.remove("active"));
});

// FORM DRAFT IN LOCAL STORAGE
function saveDraft() {
  const draft = {};
  enrollmentDraftFields.forEach((name) => {
    draft[name] = form.elements.namedItem(name)?.value?.trim() || "";
  });
  if (!draft.name && !draft.email && !draft.mobile) return;
  try { localStorage.setItem(ENROLLMENT_DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(ENROLLMENT_DRAFT_KEY) || "null");
    if (!draft) return;
    enrollmentDraftFields.forEach((name) => {
      const field = form.elements.namedItem(name);
      if (field && typeof draft[name] === "string") field.value = draft[name];
    });
  } catch {}
}
restoreDraft();
form.addEventListener("input", saveDraft);

function paymentRecord(user, values) {
  const read = (key) => String(values instanceof FormData ? values.get(key) ?? "" : values[key] ?? "").trim();
  let mobile = read("mobile");
  if (mobile && !mobile.startsWith("+91")) {
    mobile = "+91 " + mobile.replace(/^0+/, "");
  }
  return {
    uid: user.uid,
    name: read("name"),
    email: read("email"),
    mobile: mobile,
    city: read("city"),
    education: read("education"),
    goal: read("goal"),
    amount: 799,
    upiId: paymentSettings.upiId,
    status: "awaiting_payment",
    createdAt: serverTimestamp()
  };
}

function showMessage(selector, message, error = false) {
  const node = $(selector);
  if (!node) return;
  node.textContent = message;
  node.style.display = "block";
  node.classList.toggle("error", error);
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (label) button.dataset.label = label;
  button.textContent = busy ? "Please wait…" : button.dataset.label;
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code.includes("auth/invalid-email")) return "Please enter a valid email address.";
  if (code.includes("email-already-in-use")) return "This email is already registered. Please login through Student Portal.";
  if (code.includes("weak-password")) return "Password must be at least 8 characters long.";
  if (code.includes("invalid-credential") || code.includes("user-not-found")) return "Incorrect email or password.";
  return error?.message || "An unexpected error occurred. Please try again.";
}

if (configReady) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// ENROLLMENT FORM SUBMIT
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('[type="submit"]');
  setBusy(button, true, "Proceed to Payment (₹799) →");
  try {
    const values = new FormData(form);
    isSigningUp = true;
    const credential = await createUserWithEmailAndPassword(auth, String(values.get("email")).trim(), values.get("password"));
    const user = credential.user;
    await updateProfile(user, { displayName: String(values.get("name")).trim() });
    await setDoc(doc(db, "payments", user.uid), paymentRecord(user, values));
    try { localStorage.removeItem(ENROLLMENT_DRAFT_KEY); } catch {}
    isSigningUp = false;
    paymentStep.style.display = "block";
    paymentStep.scrollIntoView({ behavior: "smooth", block: "center" });
    showMessage("#form-success", "Student record registered! Please scan the QR code to finish enrollment.");
  } catch (error) {
    isSigningUp = false;
    showMessage("#form-success", friendlyError(error), true);
  } finally {
    setBusy(button, false);
  }
});

$("#copy-upi")?.addEventListener("click", async (event) => {
  try {
    await navigator.clipboard.writeText(paymentSettings.upiId);
    event.currentTarget.textContent = "VPA Copied ✓";
  } catch {
    event.currentTarget.textContent = paymentSettings.upiId;
  }
});

// UTR SUBMISSION & WHATSAPP
async function submitPaymentProof(utrInput, paidInput, messageSelector, button) {
  const user = auth?.currentUser;
  if (!user) { showMessage(messageSelector, "Session expired. Please log in first.", true); return; }
  if (!utrInput.value.trim()) { utrInput.setCustomValidity("Please enter transaction reference / UTR"); utrInput.reportValidity(); return; }
  if (!paidInput.checked) { showMessage(messageSelector, "Please check the transaction confirmation box.", true); return; }

  const whatsappWindow = window.open("about:blank", "_blank");
  setBusy(button, true, button.textContent.trim());
  try {
    const paymentRef = doc(db, "payments", user.uid);
    const snap = await getDoc(paymentRef);
    const values = snap.exists() ? snap.data() : {};
    await updateDoc(paymentRef, { status: "payment_submitted", utr: utrInput.value.trim(), submittedAt: serverTimestamp() });

    const message = [
      "Official Admission Verification · Disa Study",
      "",
      "Student Name: " + (values.name || user.displayName),
      "Registered Contact: " + (values.mobile || ""),
      "Student Email: " + (values.email || user.email),
      "Transaction UTR: " + utrInput.value.trim(),
      "Course: Digital Marketing Masterclass",
      "Amount Paid: ₹799",
      "",
      "Please verify my payment and issue my Student ID Card."
    ].join("\n");

    const whatsappUrl = "https://wa.me/919630958789?text=" + encodeURIComponent(message);
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    await renderStudent(user);
    showMessage("#dashboard-message", "UTR submitted successfully! Course access and Student ID will activate once confirmed.");
  } catch (error) {
    whatsappWindow?.close();
    showMessage(messageSelector, friendlyError(error), true);
  } finally {
    setBusy(button, false);
  }
}

$("#send-whatsapp")?.addEventListener("click", () => submitPaymentProof($("#utr"), $("#paid-confirm"), "#payment-message", $("#send-whatsapp")));
$("#resume-submit-payment")?.addEventListener("click", () => submitPaymentProof($("#resume-utr"), $("#resume-paid-confirm"), "#resume-payment-message", $("#resume-submit-payment")));

// LOGIN MODAL LOGIC
function openLogin() {
  loginModal.style.display = "grid";
  $("#mobile-drawer")?.classList.remove("active");
  $("#login-email")?.focus();
}
$("#student-login-open")?.addEventListener("click", openLogin);
$("#mobile-login-btn")?.addEventListener("click", openLogin);
$("#open-login-from-form")?.addEventListener("click", openLogin);
$("#login-close")?.addEventListener("click", () => loginModal.style.display = "none");

$("#login-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  setBusy(button, true, "Sign In to Portal");
  try {
    await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
    showMessage("#login-message", "Authenticated! Redirecting to student portal…");
  } catch (error) {
    showMessage("#login-message", friendlyError(error), true);
  } finally {
    setBusy(button, false);
  }
});

// STUDENT DASHBOARD RENDER
async function renderStudent(user) {
  document.body.classList.add("dashboard-mode");
  dashboard.style.display = "block";
  const snap = await getDoc(doc(db, "payments", user.uid));
  currentPayment = snap.exists() ? snap.data() : null;

  const displayName = currentPayment?.name || user.displayName || user.email;
  $("#dashboard-name").textContent = displayName;
  $("#dash-user-label").textContent = displayName;

  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  if (adminSnap.exists()) {
    $("#admin-panel").style.display = "block";
    await renderAdmin();
  } else {
    $("#admin-panel").style.display = "none";
    renderStudentStatus(currentPayment);
  }

  // Populate Automated ID Card Tab
  const rollNumber = `DS-${(user.uid).slice(-6).toUpperCase()}`;
  $("#id-avatar").textContent = displayName.charAt(0).toUpperCase();
  $("#id-name").textContent = displayName;
  $("#id-roll").textContent = rollNumber;
  $("#id-mobile").textContent = currentPayment?.mobile || "+91 96309 58789";
  $("#id-email").textContent = currentPayment?.email || user.email;
  $("#id-city").textContent = currentPayment?.city || "India";
}

function renderStudentStatus(payment) {
  const approved = payment?.status === "approved";
  const awaiting = payment?.status === "awaiting_payment";
  const pending = payment?.status === "payment_submitted";

  $("#status-pill").textContent = approved ? "ACTIVE SCHOLAR · VERIFIED" : awaiting ? "PAYMENT PENDING" : pending ? "UNDER ACADEMIC REVIEW" : "REGISTERED";
  $("#status-copy").textContent = approved 
    ? "Your admission is officially approved by Disa Study. Full lecture modules, resource notes, and verified ID Card are unlocked." 
    : awaiting 
    ? "Your registration is saved. Complete the ₹799 UPI transfer below to unlock the curriculum and credentials." 
    : "Your transaction reference has been recorded. Our admissions desk will approve your portal shortly.";

  $("#resume-payment-panel").style.display = awaiting ? "block" : "none";
  $("#receipt-button").style.display = approved ? "inline-flex" : "none";
  $("#receipt-button").onclick = () => downloadReceipt(payment);
}

// DASHBOARD TABS SWITCHING
document.querySelectorAll(".sidebar-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-link").forEach((l) => l.classList.remove("active"));
    document.querySelectorAll(".content-pane").forEach((pane) => pane.classList.remove("active"));
    link.classList.add("active");
    const targetPane = $(`#pane-${link.dataset.tab}`);
    if (targetPane) targetPane.classList.add("active");
  });
});

// DOWNLOAD RECEIPT
function downloadReceipt(payment) {
  const receipt = `<!doctype html><html><head><title>Receipt · Disa Study</title><style>body{font-family:'Segoe UI',sans-serif;padding:36px;color:#1e293b}.receipt{max-width:640px;margin:auto;border:1px solid #cbd5e1;padding:32px;border-radius:18px}.brand{font-size:24px;font-weight:900;color:#4f46e5;margin-bottom:6px}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9}</style></head><body><div class="receipt"><div class="brand">DISA STUDY</div><div style="font-size:12px;color:#64748b;margin-bottom:24px">Official Course Admission Voucher</div><div class="row"><span>Student Name:</span><strong>${payment.name}</strong></div><div class="row"><span>Registered Email:</span><strong>${payment.email}</strong></div><div class="row"><span>Course:</span><strong>Digital Marketing Masterclass</strong></div><div class="row"><span>Amount Paid:</span><strong>₹799.00 (INR)</strong></div><div class="row"><span>Payment Mode:</span><strong>UPI (samtiwari06@axl)</strong></div><div class="row"><span>Transaction UTR:</span><strong>${payment.utr || "Verified"}</strong></div><div class="row"><span>Admission Status:</span><strong style="color:#059669">Approved & Verified</strong></div><div style="margin-top:28px;text-align:center"><button style="padding:10px 24px;background:#4f46e5;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer" onclick="window.print()">Print Voucher</button></div></div></body></html>`;
  const w = window.open("", "_blank");
  w?.document.write(receipt);
  w?.document.close();
}

// NOTES DOWNLOAD
$("#download-notes")?.addEventListener("click", () => {
  const notes = "DISA STUDY · OFFICIAL DIGITAL MARKETING STARTER KIT\n\n" +
    "1. AUDIENCE ARCHITECTURE: Define pain points, demographic profile, and core desires.\n" +
    "2. SEARCH OPTIMIZATION: Prioritize long-tail intent, optimize title tags, clean schema.\n" +
    "3. MEDIA BUYING: Test 3 ad variations with minimum 50 conversions for machine learning optimization.\n" +
    "4. RETARGETING: Re-engage visitors who visited checkout within the last 7 days.\n\n" +
    "Disa Study — Knowledge Wing. All rights reserved.";
  const blob = new Blob([notes], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Disa-Study-Course-Notes.txt";
  a.click();
});

// ADMIN PANEL
async function renderAdmin() {
  const list = $("#admin-requests");
  list.innerHTML = "<p>Loading pending verification requests…</p>";
  try {
    const requests = await getDocs(query(collection(db, "payments"), where("status", "==", "payment_submitted")));
    if (requests.empty) { list.innerHTML = "<p>No pending payment submissions.</p>"; return; }
    list.innerHTML = "";
    requests.forEach((record) => {
      const item = record.data();
      const card = document.createElement("article");
      card.style.cssText = "padding:16px;border:1px solid #cbd5e1;border-radius:12px;margin-bottom:12px;background:#fff";
      card.innerHTML = `<p><strong>${item.name}</strong> (${item.mobile})</p><p style="font-size:12px;color:#64748b">UTR: <strong>${item.utr}</strong> · Email: ${item.email}</p><button class="btn btn-primary" style="margin-top:10px;padding:6px 14px;font-size:12px">Approve Admission</button>`;
      card.querySelector("button").onclick = async () => {
        await updateDoc(doc(db, "payments", record.id), { status: "approved", approvedAt: serverTimestamp() });
        await renderAdmin();
      };
      list.append(card);
    });
  } catch (e) { list.textContent = e.message; }
}

$("#signout-button")?.addEventListener("click", () => signOut(auth));

if (configReady) {
  onAuthStateChanged(auth, (user) => {
    if (user && isSigningUp) return;
    if (user) {
      renderStudent(user).then(() => { loginModal.style.display = "none"; });
    } else {
      document.body.classList.remove("dashboard-mode");
      dashboard.style.display = "none";
      currentPayment = null;
    }
  });
}
