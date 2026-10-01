import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (selector) => document.querySelector(selector);
const configReady = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
let auth, db, currentPayment;
const paymentSettings = { upiId: "samtiwar06@axl", qrPath: "./qr.png" };
let isSigningUp = false;
const form = $("#enrollment-form");
const paymentStep = $("#payment-step");
const loginModal = $("#login-modal");
const dashboard = $("#dashboard-screen");
const ENROLLMENT_DRAFT_KEY = "disa-enrollment-draft-v1";
const enrollmentDraftFields = ["name", "mobile", "email", "city", "education", "goal", "message"];
function buildUpiUri() {
  const params = { pa: paymentSettings.upiId, pn: "Disa Digital Agency", am: "799", cu: "INR", tn: "Disa Digital Marketing Course" };
  return `upi://pay?${Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
}
function renderPaymentOptions() {
  const uri = buildUpiUri();
  ["#pay-upi", "#resume-pay-upi"].forEach((selector) => { const link = $(selector); if (link) link.href = uri; });
  ["#payment-qr", "#resume-payment-qr"].forEach((selector) => {
    const image = $(selector);
    if (image) image.src = paymentSettings.qrPath;
  });
  document.querySelectorAll(".upi-id").forEach((node) => { node.textContent = paymentSettings.upiId; });
}

$("#year").textContent = new Date().getFullYear();
renderPaymentOptions();

function readEnrollmentDraft() {
  try { return JSON.parse(localStorage.getItem(ENROLLMENT_DRAFT_KEY) || "null"); }
  catch { return null; }
}
function saveEnrollmentDraft() {
  const draft = {};
  enrollmentDraftFields.forEach((name) => { draft[name] = form.elements.namedItem(name)?.value?.trim() || ""; });
  if (!draft.name && !draft.email && !draft.mobile) return;
  draft.savedAt = new Date().toISOString();
  try { localStorage.setItem(ENROLLMENT_DRAFT_KEY, JSON.stringify(draft)); } catch { /* Storage can be unavailable in private browsing. */ }
}
function restoreEnrollmentDraft() {
  const draft = readEnrollmentDraft();
  if (!draft) return;
  enrollmentDraftFields.forEach((name) => {
    const field = form.elements.namedItem(name);
    if (field && typeof draft[name] === "string") field.value = draft[name];
  });
  if (draft.name || draft.email || draft.mobile) {
    const resumeInstructions = $("#resume-instructions");
    if (resumeInstructions) resumeInstructions.textContent = "Your saved details are back. Re-enter your password to create the account, or use Student Login if you already signed up. The password is never stored on this device.";
  }
}
function paymentRecord(user, values) {
  const read = (key) => String(values instanceof FormData ? values.get(key) ?? "" : values[key] ?? "").trim();
  return {
    uid: user.uid,
    name: read("name"),
    email: read("email"),
    mobile: read("mobile"),
    city: read("city"),
    education: read("education"),
    goal: read("goal"),
    note: read("message"),
    amount: 799,
    upiId: paymentSettings.upiId,
    status: "awaiting_payment",
    createdAt: serverTimestamp()
  };
}
restoreEnrollmentDraft();
form.addEventListener("input", saveEnrollmentDraft);
form.addEventListener("change", saveEnrollmentDraft);

function showMessage(selector, message, error = false) {
  const node = $(selector);
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
  if (code.includes("auth/invalid-email")) return "Enter a valid email address.";
  if (code.includes("auth/user-disabled")) return "This account is disabled. Please contact Disa support.";
  if (code.includes("auth/too-many-requests")) return "Too many login attempts. Wait a few minutes, then try again.";
  if (code.includes("auth/invalid-api-key")) return "Firebase login is misconfigured. Please contact the site administrator.";
  if (code.includes("email-already-in-use")) return "This email is already registered. Use Student Login instead.";
  if (code.includes("weak-password")) return "Use a password with at least 8 characters.";
  if (code.includes("invalid-credential") || code.includes("user-not-found")) return "Email or password is incorrect.";
  if (code.includes("operation-not-allowed")) return "Email/password sign-in is disabled in the Firebase project. Enable it in Authentication → Sign-in method.";
  if (code.includes("unauthorized-domain")) return "This website domain is not authorized in Firebase. In Firebase Console, open Authentication → Settings → Authorized domains and add disa-digital-marketing-course.vercel.app.";
  if (code.includes("permission-denied")) return "Firebase blocked this request. Check that Firestore rules are published and your account is signed in.";
  if (code.includes("network-request-failed")) return "Network issue. Check your internet and try again.";
  return error?.message || "Something went wrong. Please try again.";
}

if (!configReady) {
  showMessage("#setup-notice", "Firebase setup is not connected yet. Add your Firebase web app config in firebase-config.js, then enable Email/Password Authentication and Firestore. See SETUP.md.", true);
  $("#setup-notice").style.display = "block";
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

$("#enrollment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (!configReady) { showMessage("#form-success", "Firebase setup is needed before signup can work. Open SETUP.md to connect the free Firebase project.", true); return; }
  const button = form.querySelector('[type="submit"]');
  setBusy(button, true, "Continue to payment →");
  try {
    const values = new FormData(form);
    isSigningUp = true;
    let user = auth.currentUser;
    const sameSignedInAccount = user && user.email?.toLowerCase() === String(values.get("email")).trim().toLowerCase();
    if (sameSignedInAccount) {
      const existing = await getDoc(doc(db, "payments", user.uid));
      if (existing.exists()) throw new Error("This account already has an enrollment. Use Student Login to resume it.");
    } else {
      const credential = await createUserWithEmailAndPassword(auth, String(values.get("email")).trim(), values.get("password"));
      user = credential.user;
    }
    await updateProfile(user, { displayName: String(values.get("name")).trim() });
    await setDoc(doc(db, "payments", user.uid), paymentRecord(user, values));
    try { localStorage.removeItem(ENROLLMENT_DRAFT_KEY); } catch { /* Ignore unavailable local storage. */ }
    isSigningUp = false;
    paymentStep.style.display = "block";
    paymentStep.scrollIntoView({ behavior: "smooth", block: "center" });
    showMessage("#form-success", "Your account and enrollment are saved. Pay ₹799 below, or return later using Student Login and the same email and password.");
  } catch (error) {
    isSigningUp = false;
    showMessage("#form-success", friendlyError(error) + " Your form details are saved on this device (password is not saved). If the account was already created, use Student Login to resume.", true);
  } finally { setBusy(button, false); }
});

$("#copy-upi").addEventListener("click", async (event) => {
  try { await navigator.clipboard.writeText(paymentSettings.upiId); event.currentTarget.textContent = "UPI ID copied ✓"; }
  catch { event.currentTarget.textContent = `UPI ID: ${paymentSettings.upiId}`; }
});

async function submitPaymentProof(utrInput, paidInput, messageSelector, button) {
  const user = auth?.currentUser;
  if (!user) { showMessage(messageSelector, "Please log in first.", true); return; }
  if (!utrInput.value.trim()) { utrInput.setCustomValidity("Enter the transaction reference from your UPI app."); utrInput.reportValidity(); utrInput.addEventListener("input", () => utrInput.setCustomValidity(""), { once: true }); return; }
  if (!utrInput.checkValidity()) { utrInput.reportValidity(); return; }
  if (!paidInput.checked) { showMessage(messageSelector, "Please confirm that your payment is complete.", true); return; }
  // Open the tab during the click gesture so the browser does not block it after Firestore awaits.
  const whatsappWindow = window.open("about:blank", "_blank");
  setBusy(button, true, button.textContent.trim());
  try {
    const paymentRef = doc(db, "payments", user.uid);
    const snap = await getDoc(paymentRef);
    if (!snap.exists() || snap.data().status !== "awaiting_payment") throw new Error("This payment form has already been submitted. Please refresh your dashboard.");
    const values = snap.data();
    await updateDoc(paymentRef, { status: "payment_submitted", utr: utrInput.value.trim(), submittedAt: serverTimestamp() });
    const message = ["Hi Disa Digital Agency! I have paid and want to enroll in the Complete Digital Marketing Course.", "", "Student name: " + values.name, "Mobile number: " + values.mobile, "Email: " + values.email, "City: " + values.city, "Current education / work: " + values.education, "Learning goal: " + values.goal, "Payment amount: ₹799", "UPI ID paid to: " + (values.upiId || paymentSettings.upiId), "UTR / transaction reference: " + utrInput.value.trim(), "", "I confirm that I completed this payment."].join("\n");
    const whatsappUrl = "https://wa.me/919630958789?text=" + encodeURIComponent(message);
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    await renderStudent(user);
    if (whatsappWindow) {
      showMessage("#dashboard-message", "WhatsApp opened with your enrollment details. Tap Send there. Your course will unlock after Disa approves your payment.");
    } else {
      showMessage(messageSelector, "Your UTR was saved. Popup was blocked, so use the link below to send the details on WhatsApp.");
      const link = document.createElement("a");
      link.href = whatsappUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open WhatsApp";
      $(messageSelector).append(" ", link);
    }
  } catch (error) { whatsappWindow?.close(); showMessage(messageSelector, friendlyError(error), true); }
  finally { setBusy(button, false); }
}
$("#send-whatsapp").addEventListener("click", () => submitPaymentProof($("#utr"), $("#paid-confirm"), "#payment-message", $("#send-whatsapp")));
$("#resume-submit-payment").addEventListener("click", () => submitPaymentProof($("#resume-utr"), $("#resume-paid-confirm"), "#resume-payment-message", $("#resume-submit-payment")));
function openStudentLogin() {
  const enrollmentEmail = $("#email").value.trim();
  if (enrollmentEmail) $("#login-email").value = enrollmentEmail;
  loginModal.style.display = "grid";
  $("#login-email").focus();
}
$("#student-login-open").addEventListener("click", openStudentLogin);
$("#open-login-from-form")?.addEventListener("click", openStudentLogin);
$("#login-close").addEventListener("click", () => { loginModal.style.display = "none"; });
loginModal.addEventListener("click", (event) => { if (event.target === loginModal) loginModal.style.display = "none"; });
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configReady) { showMessage("#login-message", "Connect Firebase first using SETUP.md.", true); return; }
  const button = event.currentTarget.querySelector("button[type=submit]"); setBusy(button, true, "Log in");
  try {
    await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
    showMessage("#login-message", "Signed in. Loading your dashboard…");
  }
  catch (error) { showMessage("#login-message", friendlyError(error), true); }
  finally { setBusy(button, false); }
});

async function renderStudent(user) {
  document.body.classList.add("dashboard-mode");
  dashboard.style.display = "block";
  const paymentRef = doc(db, "payments", user.uid);
  let snap = await getDoc(paymentRef);
  if (!snap.exists()) {
    const draft = readEnrollmentDraft();
    if (draft?.email?.toLowerCase() === user.email?.toLowerCase() && draft.name && draft.mobile) {
      await setDoc(paymentRef, paymentRecord(user, draft));
      try { localStorage.removeItem(ENROLLMENT_DRAFT_KEY); } catch { /* Ignore unavailable local storage. */ }
      snap = await getDoc(paymentRef);
    }
  }
  currentPayment = snap.exists() ? snap.data() : null;
  $("#dashboard-name").textContent = currentPayment?.name || user.displayName || user.email;
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  if (adminSnap.exists()) { $("#student-panel").style.display = "none"; $("#admin-panel").style.display = "block"; await renderAdmin(); }
  else { $("#admin-panel").style.display = "none"; $("#student-panel").style.display = "block"; renderStudentStatus(currentPayment); }
}

function renderStudentStatus(payment) {
  const approved = payment?.status === "approved";
  const awaiting = payment?.status === "awaiting_payment";
  const pending = payment?.status === "payment_submitted";
  $("#status-pill").textContent = approved ? "APPROVED · COURSE UNLOCKED" : awaiting ? "SIGNUP COMPLETE · PAYMENT NEEDED" : pending ? "PAYMENT UNDER REVIEW" : payment?.status === "rejected" ? "PAYMENT NEEDS ATTENTION" : "NO ENROLLMENT FOUND";
  $("#status-copy").textContent = approved ? "Your payment is approved. Your modules and notes are ready below. Weekly tests will appear when Disa publishes them." : awaiting ? "Finish the ₹799 payment to submit your enrollment for approval. You can leave now and resume from Student Login later." : pending ? "We received your UTR. Disa will verify the payment and approve your course access." : payment?.status === "rejected" ? "We could not approve this payment. Contact support with your UTR." : "We could not find enrollment details for this account. Contact support and we will help you resume.";
  $("#receipt-button").style.display = approved ? "inline-flex" : "none";
  $("#resume-payment-panel").style.display = awaiting ? "block" : "none";
  $("#locked-message").style.display = approved || awaiting ? "none" : "block";
  $("#course-content").style.display = approved ? "block" : "none";
  const approvalDate = toDate(payment?.approvedAt);
  const examUnlockDate = approvalDate ? addMonths(approvalDate, 3) : null;
  if (!approved) {
    $("#final-exam-status").textContent = "The final exam unlocks three months after Disa approves your payment.";
  } else if (!examUnlockDate) {
    $("#final-exam-status").textContent = "Your payment is approved. Disa will confirm your final exam date.";
  } else if (Date.now() < examUnlockDate.getTime()) {
    $("#final-exam-status").textContent = `Final exam opens on ${formatDate(examUnlockDate)} (three months after payment approval). Disa will add the questions before the exam.`;
  } else {
    $("#final-exam-status").textContent = "Your final exam window is open. The questions will appear here when Disa publishes the exam.";
  }
  $("#receipt-button").onclick = () => downloadReceipt(payment);
}
function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const finalDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, finalDay));
  return result;
}
function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
function downloadReceipt(payment) {
  const approvedAt = toDate(payment.approvedAt);
  const receiptNumber = `DDA-${String(payment.uid || "STUDENT").slice(-12).toUpperCase()}`;
  const receiptDate = approvedAt ? formatDate(approvedAt) : formatDate(new Date());
  const receipt = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Disa Digital Agency · Payment Receipt</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f3f1f8;color:#202033;font:15px Arial,Helvetica,sans-serif;padding:32px}.receipt{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e8e5f0;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px #251c4714}.top{padding:30px 38px;background:#17172b;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:13px}.mark{display:grid;place-items:center;width:50px;height:50px;border-radius:15px;background:#6c4cff;color:#fff;font-size:26px;font-weight:800}.brand-name{font-size:18px;font-weight:800;letter-spacing:.2px}.brand-sub{font-size:11px;color:#c4bedc;margin-top:5px;letter-spacing:1.2px;text-transform:uppercase}.paid{border:1px solid #8be0b2;color:#b9ffd5;border-radius:99px;padding:8px 13px;font-size:11px;font-weight:800;letter-spacing:1px}.body{padding:38px}.eyebrow{color:#6c4cff;font-weight:800;font-size:11px;letter-spacing:1.3px;text-transform:uppercase}.title{font-size:30px;margin:8px 0 0}.amount{font-size:42px;font-weight:800;color:#17172b;margin:22px 0 4px}.currency{font-size:18px;color:#77758a}.summary{color:#6b697d;font-size:13px;margin:0 0 28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 32px}.row{padding:14px 0;border-top:1px solid #eceaf2}.label{display:block;color:#77758a;font-size:11px;text-transform:uppercase;letter-spacing:.65px;margin-bottom:6px}.value{font-weight:700;overflow-wrap:anywhere}.section-title{font-size:14px;font-weight:800;margin:4px 0 2px}.footer{border-top:1px solid #eceaf2;padding:20px 38px;color:#77758a;font-size:11px;line-height:1.7}.actions{text-align:center;padding:0 38px 30px}.print{border:0;border-radius:11px;background:#6c4cff;color:#fff;padding:13px 20px;font-weight:700;cursor:pointer}@media(max-width:600px){body{padding:12px}.top{padding:23px;align-items:flex-start}.brand-name{font-size:15px}.mark{width:43px;height:43px}.body{padding:25px}.grid{grid-template-columns:1fr}.title{font-size:25px}.amount{font-size:36px}.footer{padding:18px 25px}}@media print{body{padding:0;background:#fff}.receipt{max-width:none;border:0;box-shadow:none;border-radius:0}.top{print-color-adjust:exact;-webkit-print-color-adjust:exact}.actions{display:none}}
    </style></head><body><main class="receipt"><header class="top"><div class="brand"><div class="mark">D</div><div><div class="brand-name">Disa Digital Agency</div><div class="brand-sub">Digital skills for a digital world</div></div></div><div class="paid">PAYMENT APPROVED</div></header><section class="body"><div class="eyebrow">Official payment receipt</div><h1 class="title">Complete Digital Marketing Course</h1><div class="amount">₹799 <span class="currency">INR</span></div><p class="summary">Payment verified and approved by Disa Digital Agency.</p><div class="section-title">Receipt details</div><div class="grid"><div class="row"><span class="label">Receipt number</span><span class="value">${escapeHtml(receiptNumber)}</span></div><div class="row"><span class="label">Payment approved on</span><span class="value">${escapeHtml(receiptDate)}</span></div><div class="row"><span class="label">Payment method</span><span class="value">UPI</span></div><div class="row"><span class="label">UPI ID</span><span class="value">samtiwar06@axl</span></div><div class="row"><span class="label">Transaction reference (UTR)</span><span class="value">${escapeHtml(payment.utr || "Not provided")}</span></div></div><div class="section-title" style="margin-top:24px">Student details</div><div class="grid"><div class="row"><span class="label">Student name</span><span class="value">${escapeHtml(payment.name || "")}</span></div><div class="row"><span class="label">Mobile number</span><span class="value">${escapeHtml(payment.mobile || "")}</span></div><div class="row"><span class="label">Email address</span><span class="value">${escapeHtml(payment.email || "")}</span></div><div class="row"><span class="label">Course</span><span class="value">Complete Digital Marketing Course</span></div></div></section><footer class="footer">Disa Digital Agency · WhatsApp support: +91 96309 58789<br>This is a computer-generated receipt. Keep this receipt and your UPI transaction details for your records.</footer><div class="actions"><button class="print" onclick="window.print()">Print / Save as PDF</button></div></main><script>setTimeout(()=>window.print(),500)<\/script></body></html>`;
  const printWindow = window.open("", "_blank");
  if (!printWindow) { alert("Allow pop-ups to open your printable receipt."); return; }
  printWindow.document.open(); printWindow.document.write(receipt); printWindow.document.close();
}
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

async function renderAdmin() {
  const list = $("#admin-requests"); list.innerHTML = "<p>Loading payment requests…</p>";
  try {
    const requests = await getDocs(query(collection(db, "payments"), where("status", "==", "payment_submitted")));
    if (requests.empty) { list.innerHTML = "<p>No payment requests waiting for approval.</p>"; return; }
    list.innerHTML = "";
    requests.forEach((record) => {
      const item = record.data(); const card = document.createElement("article"); card.className = "admin-request";
      card.innerHTML = `<h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.email)} · ${escapeHtml(item.mobile)}</p><p>UTR: <strong>${escapeHtml(item.utr)}</strong> · ₹${item.amount}</p><p>${escapeHtml(item.city)} · ${escapeHtml(item.education)}</p>`;
      const approve = document.createElement("button"); approve.className = "button"; approve.textContent = "Approve payment";
      approve.onclick = async () => { if (!confirm(`Have you verified UTR ${item.utr} in your UPI account?`)) return; await updateDoc(doc(db, "payments", record.id), { status: "approved", approvedAt: serverTimestamp(), reviewedAt: serverTimestamp() }); await renderAdmin(); };
      const reject = document.createElement("button"); reject.className = "button secondary"; reject.textContent = "Reject";
      reject.onclick = async () => { if (!confirm("Reject this payment request?")) return; await updateDoc(doc(db, "payments", record.id), { status: "rejected", reviewedAt: serverTimestamp() }); await renderAdmin(); };
      const actions = document.createElement("div"); actions.className = "admin-actions"; actions.append(approve, reject); card.append(actions); list.append(card);
    });
  } catch (error) { list.textContent = friendlyError(error); }
}

$("#signout-button").addEventListener("click", () => signOut(auth));
if (configReady) onAuthStateChanged(auth, (user) => {
  if (user && isSigningUp) return;
  if (user) {
    renderStudent(user).then(() => { loginModal.style.display = "none"; })
      .catch((error) => {
        const message = friendlyError(error);
        showMessage("#dashboard-message", message, true);
        if (loginModal.style.display === "grid") showMessage("#login-message", `Signed in, but your dashboard could not load. ${message}`, true);
      });
  }
  else { document.body.classList.remove("dashboard-mode"); dashboard.style.display = "none"; currentPayment = null; }
});

// Weekly tests and final exam questions will be added only after Disa provides them.
$("#download-notes").addEventListener("click", () => {
  const notes = "DISA DIGITAL AGENCY · DIGITAL MARKETING STARTER NOTES\n\n1. Strategy: define a target audience, goal and offer.\n2. SEO: make useful pages easy for search engines and people to find.\n3. Content: publish helpful content consistently.\n4. Social: choose platforms where your audience spends time.\n5. Paid ads: test audiences and creatives with a controlled budget.\n6. Email: build permission-based lists and send relevant messages.\n7. Analytics: track clicks, leads, conversions and cost per result.\n\nCourse-specific lesson notes can be added here as you prepare them.\n";
  const blob = new Blob([notes], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "disa-digital-marketing-notes.txt"; link.click(); URL.revokeObjectURL(url);
});







