import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (selector) => document.querySelector(selector);
const configReady = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
let auth, db, currentPayment;

// NOTE: Apni real UPI ID yahan replace karein
const paymentSettings = { upiId: "samtiwari06@axl", qrPath: "./qr.png" };
let isSigningUp = false;
const form = $("#enrollment-form");
const paymentStep = $("#payment-step");
const loginModal = $("#login-modal");
const dashboard = $("#dashboard-screen");
const ENROLLMENT_DRAFT_KEY = "disastudy-enrollment-draft-v1";
const enrollmentDraftFields = ["name", "mobile", "email", "city", "education", "goal", "message"];

function buildUpiUri() {
  const params = { pa: paymentSettings.upiId, pn: "Disa Study", am: "799.00", cu: "INR", tn: "Disa Study Course Fee" };
  return `upi://pay?${Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
}

function renderPaymentOptions() {
  const uri = buildUpiUri();
  ["#pay-upi", "#resume-pay-upi"].forEach((selector) => { const link = $(selector); if (link) link.href = uri; });
  
  // Dynamic working QR code API fallback if local image isn't available
  const dynamicQr = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(uri)}`;
  ["#payment-qr", "#resume-payment-qr"].forEach((selector) => {
    const image = $(selector);
    if (image) image.src = dynamicQr;
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
  try { localStorage.setItem(ENROLLMENT_DRAFT_KEY, JSON.stringify(draft)); } catch { }
}

function restoreEnrollmentDraft() {
  const draft = readEnrollmentDraft();
  if (!draft) return;
  enrollmentDraftFields.forEach((name) => {
    const field = form.elements.namedItem(name);
    if (field && typeof draft[name] === "string") field.value = draft[name];
  });
}

function paymentRecord(user, values) {
  const read = (key) => String(values instanceof FormData ? values.get(key) ?? "" : values[key] ?? "").trim();
  let mobileNum = read("mobile");
  if (mobileNum && !mobileNum.startsWith("+91")) {
    mobileNum = "+91 " + mobileNum.replace(/^0+/, "");
  }
  return {
    uid: user.uid,
    name: read("name"),
    email: read("email"),
    mobile: mobileNum,
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
  if (code.includes("auth/invalid-email")) return "Enter a valid email address.";
  if (code.includes("auth/user-disabled")) return "This account is disabled. Contact Disa Study support.";
  if (code.includes("email-already-in-use")) return "This email is already registered. Use Student Login.";
  if (code.includes("weak-password")) return "Password must be at least 8 characters.";
  if (code.includes("invalid-credential") || code.includes("user-not-found")) return "Incorrect email or password.";
  return error?.message || "Something went wrong. Please try again.";
}

if (!configReady) {
  showMessage("#setup-notice", "Firebase setup is required. Check firebase-config.js", true);
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

$("#enrollment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('[type="submit"]');
  setBusy(button, true, "Continue to payment →");
  try {
    const values = new FormData(form);
    isSigningUp = true;
    let user = auth.currentUser;
    const sameSignedInAccount = user && user.email?.toLowerCase() === String(values.get("email")).trim().toLowerCase();
    if (sameSignedInAccount) {
      const existing = await getDoc(doc(db, "payments", user.uid));
      if (existing.exists()) throw new Error("This account already has an enrollment. Use Student Login to resume.");
    } else {
      const credential = await createUserWithEmailAndPassword(auth, String(values.get("email")).trim(), values.get("password"));
      user = credential.user;
    }
    await updateProfile(user, { displayName: String(values.get("name")).trim() });
    await setDoc(doc(db, "payments", user.uid), paymentRecord(user, values));
    try { localStorage.removeItem(ENROLLMENT_DRAFT_KEY); } catch {}
    isSigningUp = false;
    paymentStep.style.display = "block";
    paymentStep.scrollIntoView({ behavior: "smooth", block: "center" });
    showMessage("#form-success", "Account created successfully! Complete the payment below.");
  } catch (error) {
    isSigningUp = false;
    showMessage("#form-success", friendlyError(error), true);
  } finally { setBusy(button, false); }
});

$("#copy-upi").addEventListener("click", async (event) => {
  try { await navigator.clipboard.writeText(paymentSettings.upiId); event.currentTarget.textContent = "UPI ID copied ✓"; }
  catch { event.currentTarget.textContent = `UPI ID: ${paymentSettings.upiId}`; }
});

async function submitPaymentProof(utrInput, paidInput, messageSelector, button) {
  const user = auth?.currentUser;
  if (!user) { showMessage(messageSelector, "Please log in first.", true); return; }
  if (!utrInput.value.trim()) { utrInput.setCustomValidity("Enter transaction reference (UTR)"); utrInput.reportValidity(); return; }
  if (!paidInput.checked) { showMessage(messageSelector, "Please confirm the payment.", true); return; }
  
  const whatsappWindow = window.open("about:blank", "_blank");
  setBusy(button, true, button.textContent.trim());
  try {
    const paymentRef = doc(db, "payments", user.uid);
    const snap = await getDoc(paymentRef);
    if (!snap.exists()) throw new Error("Enrollment not found.");
    const values = snap.data();
    await updateDoc(paymentRef, { status: "payment_submitted", utr: utrInput.value.trim(), submittedAt: serverTimestamp() });
    
    const message = [
      "Hi Disa Study! I have completed payment for the Digital Marketing Course.",
      "",
      "Student Name: " + values.name,
      "Mobile: " + values.mobile,
      "Email: " + values.email,
      "City: " + values.city,
      "Amount: ₹799",
      "UTR: " + utrInput.value.trim(),
      "",
      "Please verify and unlock my course."
    ].join("\n");
    
    const whatsappUrl = "https://wa.me/919630958789?text=" + encodeURIComponent(message);
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    await renderStudent(user);
    showMessage("#dashboard-message", "Payment submitted! WhatsApp opened for fast approval.");
  } catch (error) {
    whatsappWindow?.close();
    showMessage(messageSelector, friendlyError(error), true);
  } finally { setBusy(button, false); }
}

$("#send-whatsapp")?.addEventListener("click", () => submitPaymentProof($("#utr"), $("#paid-confirm"), "#payment-message", $("#send-whatsapp")));
$("#resume-submit-payment")?.addEventListener("click", () => submitPaymentProof($("#resume-utr"), $("#resume-paid-confirm"), "#resume-payment-message", $("#resume-submit-payment")));

function openStudentLogin() {
  const enrollmentEmail = $("#email")?.value.trim();
  if (enrollmentEmail) $("#login-email").value = enrollmentEmail;
  loginModal.style.display = "grid";
  $("#login-email")?.focus();
}

$("#student-login-open").addEventListener("click", openStudentLogin);
$("#open-login-from-form")?.addEventListener("click", openStudentLogin);
$("#login-close").addEventListener("click", () => { loginModal.style.display = "none"; });

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]"); 
  setBusy(button, true, "Log in");
  try {
    await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
    showMessage("#login-message", "Signed in successfully! Loading...");
  } catch (error) { showMessage("#login-message", friendlyError(error), true); }
  finally { setBusy(button, false); }
});

async function renderStudent(user) {
  document.body.classList.add("dashboard-mode");
  dashboard.style.display = "block";
  const paymentRef = doc(db, "payments", user.uid);
  let snap = await getDoc(paymentRef);
  currentPayment = snap.exists() ? snap.data() : null;
  $("#dashboard-name").textContent = currentPayment?.name || user.displayName || user.email;
  
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  if (adminSnap.exists()) {
    $("#student-panel").style.display = "none";
    $("#admin-panel").style.display = "block";
    await renderAdmin();
  } else {
    $("#admin-panel").style.display = "none";
    $("#student-panel").style.display = "block";
    renderStudentStatus(currentPayment);
  }
}

function renderStudentStatus(payment) {
  const approved = payment?.status === "approved";
  const awaiting = payment?.status === "awaiting_payment";
  const pending = payment?.status === "payment_submitted";
  
  $("#status-pill").textContent = approved ? "VERIFIED STUDENT · ACCESS GRANTED" : awaiting ? "SIGNUP COMPLETE · PAYMENT PENDING" : pending ? "PAYMENT IN REVIEW" : "NO RECORD FOUND";
  $("#status-copy").textContent = approved 
    ? "Welcome to Disa Study! Your enrollment is officially approved. Access your study modules, materials, and automated Student ID below."
    : awaiting 
    ? "Please complete the ₹799 UPI payment to activate your student credentials." 
    : "We have received your UTR. Your credentials and ID card are being activated.";

  $("#id-card-btn").style.display = (approved || pending) ? "inline-flex" : "none";
  $("#resume-payment-panel").style.display = awaiting ? "block" : "none";
  $("#course-content").style.display = approved ? "block" : "none";
  
  $("#id-card-btn").onclick = () => generateStudentIdCard(payment || auth.currentUser);
}

// ================= AUTOMATED STUDENT ID CARD GENERATOR =================
function generateStudentIdCard(data) {
  const studentId = `DS-${String(data.uid || auth.currentUser?.uid || "2026").slice(-8).toUpperCase()}`;
  const studentName = escapeHtml(data.name || auth.currentUser?.displayName || "Student Name");
  const studentEmail = escapeHtml(data.email || auth.currentUser?.email || "");
  const studentMobile = escapeHtml(data.mobile || "");
  const studentCity = escapeHtml(data.city || "India");
  const issueDate = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date());

  const idHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Student ID Card · Disa Study</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:30px;background:#f3f1f9;font-family:'Segoe UI',Roboto,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center}
    .id-wrapper{width:360px;height:550px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 25px 50px rgba(78,38,206,0.18);position:relative;border:1px solid #e7e2f5;display:flex;flex-direction:column}
    .id-header{background:linear-gradient(135deg,#5e3cee 0%,#281769 100%);padding:22px 20px;text-align:center;color:#fff;position:relative}
    .id-brand{font-size:20px;font-weight:900;letter-spacing:0.8px;display:flex;align-items:center;justify-content:center;gap:8px}
    .id-brand-mark{width:32px;height:32px;border-radius:9px;background:#fff;color:#5e3cee;display:grid;place-items:center;font-size:18px;font-weight:900}
    .id-sub{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#d5cbff;margin-top:4px}
    .id-photo-section{text-align:center;margin-top:-35px;position:relative;z-index:2}
    .id-avatar{width:86px;height:86px;border-radius:50%;background:#f1edff;color:#5e3cee;display:inline-grid;place-items:center;font-size:38px;font-weight:bold;border:4px solid #fff;box-shadow:0 8px 18px rgba(0,0,0,0.1)}
    .id-body{padding:14px 24px;text-align:center;flex:1;display:flex;flex-direction:column}
    .student-name{font-size:20px;font-weight:800;color:#18162e;margin:6px 0 3px}
    .student-badge{display:inline-block;background:#e9fbf0;color:#1d784a;font-size:11px;font-weight:800;padding:4px 10px;border-radius:99px;letter-spacing:0.5px}
    .id-meta-grid{margin:18px 0;text-align:left;display:grid;gap:8px;background:#f9f8fe;padding:12px 14px;border-radius:14px;border:1px solid #ece8f7}
    .meta-row{display:flex;justify-content:space-between;font-size:12px}
    .meta-label{color:#79778c;font-weight:600}
    .meta-value{color:#1a192e;font-weight:700}
    .id-footer{padding:12px;text-align:center;background:#faf9ff;border-top:1px dashed #e2ddf3;font-size:10px;color:#858399}
    .actions{margin-top:20px;display:flex;gap:12px}
    .btn-print{border:0;background:#5e3cee;color:#fff;font-weight:700;padding:12px 24px;border-radius:12px;cursor:pointer;box-shadow:0 8px 16px rgba(94,60,238,0.25)}
    @media print{
      body{background:transparent;padding:0}
      .actions{display:none}
      .id-wrapper{box-shadow:none;border:1px solid #ccc}
    }
  </style>
</head>
<body>
  <div class="id-wrapper">
    <div class="id-header">
      <div class="id-brand"><span class="id-brand-mark">D</span> Disa Study</div>
      <div class="id-sub">Official Student ID Card</div>
    </div>
    <div class="id-photo-section">
      <div class="id-avatar">${studentName.charAt(0).toUpperCase()}</div>
    </div>
    <div class="id-body">
      <div class="student-name">${studentName}</div>
      <div><span class="student-badge">ACTIVE ENROLLMENT</span></div>
      <div class="id-meta-grid">
        <div class="meta-row"><span class="meta-label">Student ID:</span><span class="meta-value">${studentId}</span></div>
        <div class="meta-row"><span class="meta-label">Course:</span><span class="meta-value">Digital Marketing</span></div>
        <div class="meta-row"><span class="meta-label">Mobile:</span><span class="meta-value">${studentMobile}</span></div>
        <div class="meta-row"><span class="meta-label">Email:</span><span class="meta-value">${studentEmail}</span></div>
        <div class="meta-row"><span class="meta-label">City:</span><span class="meta-value">${studentCity}</span></div>
        <div class="meta-row"><span class="meta-label">Issued On:</span><span class="meta-value">${issueDate}</span></div>
      </div>
    </div>
    <div class="id-footer">
      Disa Study · Student Verification Portal<br>Valid for the registered academic session.
    </div>
  </div>
  <div class="actions">
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;

  const idWindow = window.open("", "_blank");
  if (!idWindow) {
    alert("Allow pop-ups to open your Student ID Card.");
    return;
  }
  idWindow.document.open();
  idWindow.document.write(idHtml);
  idWindow.document.close();
}

function escapeHtml(val = "") { 
  return String(val).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); 
}

async function renderAdmin() {
  const list = $("#admin-requests"); 
  list.innerHTML = "<p>Loading requests…</p>";
  try {
    const requests = await getDocs(query(collection(db, "payments"), where("status", "==", "payment_submitted")));
    if (requests.empty) { list.innerHTML = "<p>No payment requests pending approval.</p>"; return; }
    list.innerHTML = "";
    requests.forEach((record) => {
      const item = record.data(); 
      const card = document.createElement("article"); 
      card.className = "admin-request";
      card.innerHTML = `<h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.email)} · ${escapeHtml(item.mobile)}</p><p>UTR: <strong>${escapeHtml(item.utr)}</strong> · ₹${item.amount}</p>`;
      const approve = document.createElement("button"); 
      approve.className = "button"; 
      approve.textContent = "Approve";
      approve.onclick = async () => { 
        if (!confirm(`Verify payment for ${item.name}?`)) return; 
        await updateDoc(doc(db, "payments", record.id), { status: "approved", approvedAt: serverTimestamp() }); 
        await renderAdmin(); 
      };
      card.append(approve); 
      list.append(card);
    });
  } catch (error) { list.textContent = friendlyError(error); }
}

$("#signout-button").addEventListener("click", () => signOut(auth));

if (configReady) onAuthStateChanged(auth, (user) => {
  if (user && isSigningUp) return;
  if (user) {
    renderStudent(user).then(() => { loginModal.style.display = "none"; });
  } else {
    document.body.classList.remove("dashboard-mode");
    dashboard.style.display = "none";
    currentPayment = null;
  }
});
