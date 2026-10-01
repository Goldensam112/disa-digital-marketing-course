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
const ENROLLMENT_DRAFT_KEY = "disastudy-v5-draft";
const enrollmentDraftFields = ["name", "mobile", "email", "city", "education", "goal"];

function buildUpiUri() {
  const params = {
    pa: paymentSettings.upiId,
    pn: "Disa Study",
    am: "799.00",
    cu: "INR",
    tn: "Disa Study 20 Modules Course"
  };
  return `upi://pay?${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

function renderPaymentOptions() {
  const uri = buildUpiUri();
  ["#pay-upi", "#resume-pay-upi"].forEach((selector) => {
    const link = $(selector);
    if (link) link.href = uri;
  });

  ["#payment-qr", "#resume-payment-qr"].forEach((selector) => {
    const img = $(selector);
    if (img) {
      img.src = paymentSettings.qrPath;
      img.onerror = () => {
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(uri)}`;
      };
    }
  });

  document.querySelectorAll(".upi-id").forEach((el) => {
    el.textContent = paymentSettings.upiId;
  });
}

$("#year").textContent = new Date().getFullYear();
renderPaymentOptions();

// LEFT-SIDE OFF-CANVAS DRAWER LOGIC (FOR BOTH WEBSITE & DASHBOARD)
const drawer = $("#left-drawer");
const backdrop = $("#drawer-backdrop");
function openDrawer() {
  drawer?.classList.add("active");
  backdrop?.classList.add("active");
}
function closeDrawer() {
  drawer?.classList.remove("active");
  backdrop?.classList.remove("active");
}

$("#left-drawer-open")?.addEventListener("click", openDrawer);
$("#dash-drawer-open")?.addEventListener("click", openDrawer);
$("#drawer-close-btn")?.addEventListener("click", closeDrawer);
backdrop?.addEventListener("click", closeDrawer);
document.querySelectorAll(".drawer-link").forEach((link) => {
  link.addEventListener("click", closeDrawer);
});

// FORM DRAFT STORAGE
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
  if (code.includes("email-already-in-use")) return "This email is already registered. Please login using Student Login.";
  if (code.includes("weak-password")) return "Password must be at least 8 characters.";
  if (code.includes("invalid-credential") || code.includes("user-not-found")) return "Incorrect email or password.";
  return error?.message || "An error occurred. Please try again.";
}

if (configReady) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// FORM SUBMISSION
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('[type="submit"]');
  setBusy(button, true, "Continue to Payment (₹799) →");
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
    showMessage("#form-success", "Student registered! Scan the QR code below to complete admission.");
  } catch (error) {
    isSigningUp = false;
    showMessage("#form-success", friendlyError(error), true);
  } finally {
    setBusy(button, false);
  }
});

$("#copy-upi")?.addEventListener("click", async (e) => {
  try {
    await navigator.clipboard.writeText(paymentSettings.upiId);
    e.currentTarget.textContent = "Copied ✓";
  } catch {
    e.currentTarget.textContent = paymentSettings.upiId;
  }
});

// UTR SUBMISSION & AUTOMATED WHATSAPP
async function submitPaymentProof(utrInput, paidInput, messageSelector, button) {
  const user = auth?.currentUser;
  if (!user) { showMessage(messageSelector, "Session expired. Please log in first.", true); return; }
  if (!utrInput.value.trim()) { utrInput.setCustomValidity("Please enter transaction UTR reference"); utrInput.reportValidity(); return; }
  if (!paidInput.checked) { showMessage(messageSelector, "Please check the payment confirmation box.", true); return; }

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
      "Mobile: " + (values.mobile || ""),
      "Email: " + (values.email || user.email),
      "Course: 20 Modules Digital & AI Marketing",
      "Amount Paid: ₹799",
      "Transaction UTR: " + utrInput.value.trim(),
      "",
      "Please verify my UTR and approve my Student ID Card."
    ].join("\n");

    const whatsappUrl = "https://wa.me/919630958789?text=" + encodeURIComponent(message);
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    await renderStudent(user);
    showMessage("#dashboard-message", "Payment submitted! Access will unlock once verified.");
  } catch (error) {
    whatsappWindow?.close();
    showMessage(messageSelector, friendlyError(error), true);
  } finally {
    setBusy(button, false);
  }
}

$("#send-whatsapp")?.addEventListener("click", () => submitPaymentProof($("#utr"), $("#paid-confirm"), "#payment-message", $("#send-whatsapp")));
$("#resume-submit-payment")?.addEventListener("click", () => submitPaymentProof($("#resume-utr"), $("#resume-paid-confirm"), "#resume-payment-message", $("#resume-submit-payment")));

// LOGIN MODAL CONTROLS
function openLogin() {
  loginModal.style.display = "grid";
  closeDrawer();
  $("#login-email")?.focus();
}
$("#student-login-open")?.addEventListener("click", openLogin);
$("#drawer-login-btn")?.addEventListener("click", openLogin);
$("#open-login-from-form")?.addEventListener("click", openLogin);
$("#login-close")?.addEventListener("click", () => loginModal.style.display = "none");

$("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.currentTarget.querySelector("button[type=submit]");
  setBusy(button, true, "Signing In...");
  try {
    await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
    showMessage("#login-message", "Verified! Redirecting to student portal…");
  } catch (error) {
    showMessage("#login-message", friendlyError(error), true);
  } finally {
    setBusy(button, false);
  }
});

// STUDENT DASHBOARD RENDER & TABS
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

  // Populate Automated Student ID Card
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

  $("#status-pill").textContent = approved ? "VERIFIED SCHOLAR" : awaiting ? "PAYMENT PENDING" : pending ? "IN VERIFICATION" : "REGISTERED";
  $("#status-copy").textContent = approved 
    ? "Your admission is approved. All 20 digital & AI modules, study notes, and your verified Student ID Card are active."
    : awaiting 
    ? "Complete your ₹799 UPI transfer below to unlock the curriculum and download your Student ID Card."
    : "Your transaction UTR is submitted. Disa Study desk will approve your portal access shortly.";

  $("#resume-payment-panel").style.display = awaiting ? "block" : "none";
  $("#receipt-button").style.display = approved ? "inline-flex" : "none";
  $("#receipt-button").onclick = () => downloadInvoice(payment);

  // 3-Month Final Exam Window Logic
  const approvalDate = toDate(payment?.approvedAt);
  const examUnlockDate = approvalDate ? addMonths(approvalDate, 3) : null;
  const examNode = $("#final-exam-status");

  if (!approved) {
    examNode.textContent = "The final exam unlocks 3 months after Disa Study approves your payment.";
  } else if (!examUnlockDate) {
    examNode.textContent = "Your payment is approved. Disa Study desk will confirm your final exam schedule.";
  } else if (Date.now() < examUnlockDate.getTime()) {
    examNode.textContent = `Your final exam opens on ${formatDate(examUnlockDate)} (exactly three months after payment approval). Disa Study will publish the question sets before this date.`;
  } else {
    examNode.textContent = "Your final exam window is officially open! The questions will appear here once Disa Study publishes the exam session.";
  }
}

function toDate(v) {
  if (v?.toDate) return v.toDate();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(d, m) {
  const res = new Date(d);
  res.setMonth(res.getMonth() + m);
  return res;
}

function formatDate(d) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

// DASHBOARD TAB SWITCHING
document.querySelectorAll(".dash-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".dash-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".dash-pane").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const target = $(`#pane-${btn.dataset.tab}`);
    if (target) target.classList.add("active");
  });
});

// INTERACTIVE WEEKLY QUIZ
$("#submit-quiz-btn")?.addEventListener("click", () => {
  let score = 0;
  if ($('input[name="q1"]:checked')?.value === "A") score++;
  if ($('input[name="q2"]:checked')?.value === "A") score++;
  if ($('input[name="q3"]:checked')?.value === "A") score++;
  
  const resultNode = $("#quiz-result");
  resultNode.style.display = "block";
  resultNode.textContent = `You scored ${score} out of 3! Correct answers reviewed.`;
});

// CORPORATE TAX INVOICE GENERATOR
function downloadInvoice(payment) {
  const invoiceNo = `INV-DDA-${String(payment.uid || "2026").slice(-8).toUpperCase()}`;
  const invoiceDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  const invoiceHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice · Disa Study</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:24px;font-family:'Plus Jakarta Sans',sans-serif;background:#f8fafc;color:#1e293b}
    .invoice-card{max-width:760px;margin:auto;background:#fff;border-radius:18px;border:1px solid #cbd5e1;box-shadow:0 10px 25px rgba(0,0,0,0.06);overflow:hidden;position:relative}
    .inv-header{background:linear-gradient(135deg,#1e1b4b,#4338ca);color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:center}
    .inv-brand{font-size:22px;font-weight:900;letter-spacing:-0.5px}
    .inv-brand span{color:#818cf8}
    .inv-badge{background:rgba(255,255,255,0.15);padding:6px 14px;border-radius:99px;font-size:11px;font-weight:800;letter-spacing:1px;border:1px solid rgba(255,255,255,0.25)}
    .inv-body{padding:32px}
    .inv-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #f1f5f9}
    .meta-box h5{font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.8px;margin-bottom:6px}
    .meta-box p{font-size:13px;font-weight:700;color:#0f172a;line-height:1.5}
    .inv-table{width:100%;border-collapse:collapse;margin:24px 0}
    .inv-table th{background:#f8fafc;padding:12px;text-align:left;font-size:12px;font-weight:800;color:#475569;border-bottom:2px solid #e2e8f0}
    .inv-table td{padding:14px 12px;font-size:13px;border-bottom:1px solid #f1f5f9}
    .inv-summary{max-width:300px;margin-left:auto;margin-top:20px;display:grid;gap:8px;font-size:13px}
    .sum-row{display:flex;justify-content:space-between;padding:4px 0}
    .sum-total{border-top:2px solid #0f172a;padding-top:8px;font-size:16px;font-weight:900;color:#0f172a}
    .inv-footer{background:#fafafa;padding:20px 32px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:74px;font-weight:900;color:rgba(79,70,229,0.04);pointer-events:none;white-space:nowrap}
    .seal{border:2px dashed #10b981;color:#047857;padding:6px 12px;border-radius:8px;font-weight:800;display:inline-block;font-size:11px}
    .btn-print{display:block;margin:24px auto 0;background:#4338ca;color:#fff;border:0;padding:12px 28px;border-radius:10px;font-weight:800;cursor:pointer;font-size:13px}
    @media print{
      body{background:none;padding:0}
      .btn-print{display:none}
      .invoice-card{box-shadow:none;border:none}
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="watermark">PAID & VERIFIED</div>
    <div class="inv-header">
      <div>
        <div class="inv-brand">DISA <span>STUDY</span></div>
        <div style="font-size:11px;opacity:0.85;margin-top:2px">Department of Digital Education</div>
      </div>
      <div class="inv-badge">ORIGINAL TAX INVOICE</div>
    </div>
    <div class="inv-body">
      <div class="inv-meta-grid">
        <div class="meta-box">
          <h5>Billed To (Student)</h5>
          <p>${escapeHtml(payment.name || "Student")}</p>
          <p style="font-weight:500;color:#64748b">${escapeHtml(payment.email || "")}</p>
          <p style="font-weight:500;color:#64748b">${escapeHtml(payment.mobile || "")}</p>
          <p style="font-weight:500;color:#64748b">${escapeHtml(payment.city || "India")}</p>
        </div>
        <div class="meta-box" style="text-align:right">
          <h5>Invoice Details</h5>
          <p>Invoice No: ${invoiceNo}</p>
          <p style="font-weight:500;color:#64748b">Date: ${invoiceDate}</p>
          <p style="font-weight:500;color:#64748b">Payment Mode: UPI (${paymentSettings.upiId})</p>
          <p style="font-weight:500;color:#64748b">UTR: <strong>${escapeHtml(payment.utr || "Verified")}</strong></p>
        </div>
      </div>

      <table class="inv-table">
        <thead>
          <tr>
            <th>Description of Educational Service</th>
            <th>SAC Code</th>
            <th style="text-align:right">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Complete Digital & AI Marketing Masterclass (20 Modules)</strong>
              <div style="font-size:11px;color:#64748b;margin-top:4px">Includes Automated Digital Student ID Card, Quizzes & Official Exam Window</div>
            </td>
            <td>999293</td>
            <td style="text-align:right">₹677.12</td>
          </tr>
          <tr>
            <td>CGST (9%)</td>
            <td>-</td>
            <td style="text-align:right">₹60.94</td>
          </tr>
          <tr>
            <td>SGST (9%)</td>
            <td>-</td>
            <td style="text-align:right">₹60.94</td>
          </tr>
        </tbody>
      </table>

      <div class="inv-summary">
        <div class="sum-row"><span>Gross Tuition Fee:</span><span>₹677.12</span></div>
        <div class="sum-row"><span>Total Tax (18% GST):</span><span>₹121.88</span></div>
        <div class="sum-row sum-total"><span>Total Paid:</span><span>₹799.00</span></div>
      </div>
    </div>
    <div class="inv-footer">
      <div>
        <div class="seal">✓ PAYMENT VERIFIED BY DISA STUDY</div>
      </div>
      <div style="text-align:right">
        This is a computer-generated tax invoice. No signature required.
      </div>
    </div>
  </div>
  <button class="btn-print" onclick="window.print()">🖨️ Print Tax Invoice / Save PDF</button>
</body>
</html>`;

  const w = window.open("", "_blank");
  w?.document.write(invoiceHtml);
  w?.document.close();
}

function escapeHtml(val = "") {
  return String(val).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// NOTES DOWNLOAD
$("#download-notes")?.addEventListener("click", () => {
  const notes = "DISA STUDY · COMPLETE DIGITAL & AI MARKETING RESOURCE KIT\n\n" +
    "1. AUDIENCE ARCHITECTURE: Define pain points, demographic profile, and core desires.\n" +
    "2. SEARCH OPTIMIZATION: Prioritize long-tail intent, optimize title tags, clean schema.\n" +
    "3. AI PROMPTING: Use structured roles, objective context, negative constraints, and output format.\n" +
    "4. MEDIA BUYING: Test 3 ad variations with minimum 50 conversions for machine learning optimization.\n" +
    "5. RETARGETING: Re-engage visitors who visited checkout within the last 7 days.\n\n" +
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
