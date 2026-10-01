import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (selector) => document.querySelector(selector);
const configReady = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
let auth, db, currentPayment;
let isSigningUp = false;
const form = $("#enrollment-form");
const paymentStep = $("#payment-step");
const loginModal = $("#login-modal");
const dashboard = $("#dashboard-screen");
const upiUri = "upi://pay?pa=samtiwar06%40axl&pn=Disa%20Digital%20Agency&am=799&cu=INR&tn=Disa%20Digital%20Marketing%20Course";

$("#year").textContent = new Date().getFullYear();
$("#pay-upi").href = upiUri;
$("#payment-qr").src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=" + encodeURIComponent(upiUri);
$("#resume-payment-qr").src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=" + encodeURIComponent(upiUri);
$("#resume-pay-upi").href = upiUri;

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
  if (code.includes("email-already-in-use")) return "This email is already registered. Use Student Login instead.";
  if (code.includes("weak-password")) return "Use a password with at least 8 characters.";
  if (code.includes("invalid-credential") || code.includes("user-not-found")) return "Email or password is incorrect.";
  if (code.includes("operation-not-allowed")) return "Email/password sign-in is disabled in the Firebase project. Enable it in Authentication → Sign-in method.";
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
    const credential = await createUserWithEmailAndPassword(auth, values.get("email").trim(), values.get("password"));
    await updateProfile(credential.user, { displayName: values.get("name").trim() });
    await setDoc(doc(db, "payments", credential.user.uid), {
      uid: credential.user.uid,
      name: values.get("name").trim(),
      email: values.get("email").trim(),
      mobile: values.get("mobile").trim(),
      city: values.get("city").trim(),
      education: values.get("education"),
      goal: values.get("goal"),
      note: values.get("message").trim(),
      amount: 799,
      upiId: "samtiwar06@axl",
      status: "awaiting_payment",
      createdAt: serverTimestamp()
    });
    isSigningUp = false;
    paymentStep.style.display = "block";
    paymentStep.scrollIntoView({ behavior: "smooth", block: "center" });
    showMessage("#form-success", "Account created. Pay ₹799 using UPI below, then submit your UTR.");
  } catch (error) {
    isSigningUp = false;
    showMessage("#form-success", friendlyError(error), true);
  } finally { setBusy(button, false); }
});

$("#copy-upi").addEventListener("click", async (event) => {
  try { await navigator.clipboard.writeText("samtiwar06@axl"); event.currentTarget.textContent = "UPI ID copied ✓"; }
  catch { event.currentTarget.textContent = "UPI ID: samtiwar06@axl"; }
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
    const message = ["Hi Disa Digital Agency! I have paid and want to enroll in the Complete Digital Marketing Course.", "", "Student name: " + values.name, "Mobile number: " + values.mobile, "Email: " + values.email, "City: " + values.city, "Current education / work: " + values.education, "Learning goal: " + values.goal, "Payment amount: ₹799", "UPI ID paid to: samtiwar06@axl", "UTR / transaction reference: " + utrInput.value.trim(), "", "I confirm that I completed this payment."].join("\n");
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
$("#student-login-open").addEventListener("click", () => { loginModal.style.display = "grid"; });
$("#login-close").addEventListener("click", () => { loginModal.style.display = "none"; });
loginModal.addEventListener("click", (event) => { if (event.target === loginModal) loginModal.style.display = "none"; });
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configReady) { showMessage("#login-message", "Connect Firebase first using SETUP.md.", true); return; }
  const button = event.currentTarget.querySelector("button[type=submit]"); setBusy(button, true, "Log in");
  try { await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value); loginModal.style.display = "none"; }
  catch (error) { showMessage("#login-message", friendlyError(error), true); }
  finally { setBusy(button, false); }
});

async function renderStudent(user) {
  const snap = await getDoc(doc(db, "payments", user.uid));
  currentPayment = snap.exists() ? snap.data() : null;
  $("#dashboard-name").textContent = currentPayment?.name || user.displayName || user.email;
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  document.body.classList.add("dashboard-mode");
  dashboard.style.display = "block";
  if (adminSnap.exists()) { $("#student-panel").style.display = "none"; $("#admin-panel").style.display = "block"; await renderAdmin(); }
  else { $("#admin-panel").style.display = "none"; $("#student-panel").style.display = "block"; renderStudentStatus(currentPayment); }
}

function renderStudentStatus(payment) {
  const approved = payment?.status === "approved";
  const awaiting = payment?.status === "awaiting_payment";
  const pending = payment?.status === "payment_submitted";
  $("#status-pill").textContent = approved ? "APPROVED · COURSE UNLOCKED" : awaiting ? "SIGNUP COMPLETE · PAYMENT NEEDED" : pending ? "PAYMENT UNDER REVIEW" : payment?.status === "rejected" ? "PAYMENT NEEDS ATTENTION" : "NO ENROLLMENT FOUND";
  $("#status-copy").textContent = approved ? "Your payment is approved. Your course, tests and notes are ready below." : awaiting ? "Finish the ₹799 payment to submit your enrollment for approval." : pending ? "We received your UTR. Disa will verify the payment and approve your course access." : payment?.status === "rejected" ? "We could not approve this payment. Contact support with your UTR." : "Start from the course enrollment form to create your student account.";
  $("#receipt-button").style.display = approved ? "inline-flex" : "none";
  $("#resume-payment-panel").style.display = awaiting ? "block" : "none";
  $("#locked-message").style.display = approved || awaiting ? "none" : "block";
  $("#course-content").style.display = approved ? "block" : "none";
  $("#receipt-button").onclick = () => downloadReceipt(payment);
}
function downloadReceipt(payment) {
  const receipt = `<!doctype html><html><head><meta charset="utf-8"><title>Disa Digital Agency Payment Receipt</title><style>body{font:16px Arial,sans-serif;max-width:700px;margin:40px auto;color:#17172b;padding:24px}.box{border:2px solid #6c4cff;border-radius:18px;padding:30px}.brand{color:#6c4cff;font-size:14px;font-weight:bold;letter-spacing:1px}.amount{font-size:38px;font-weight:bold;margin:22px 0}.row{padding:12px 0;border-bottom:1px solid #ddd}.label{color:#666;width:210px;display:inline-block}@media print{button{display:none}}</style></head><body><div class="box"><div class="brand">DISA DIGITAL AGENCY</div><h1>Course Payment Receipt</h1><div class="amount">₹799 · Paid</div><div class="row"><span class="label">Student</span>${escapeHtml(payment.name)}</div><div class="row"><span class="label">Email</span>${escapeHtml(payment.email)}</div><div class="row"><span class="label">Mobile</span>${escapeHtml(payment.mobile)}</div><div class="row"><span class="label">Course</span>Complete Digital Marketing Course</div><div class="row"><span class="label">UPI Transaction Reference</span>${escapeHtml(payment.utr || "")}</div><p>Payment approved by Disa Digital Agency.</p><button onclick="window.print()">Print / Save as PDF</button></div><script>setTimeout(()=>window.print(),400)<\/script></body></html>`;
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
  if (user) { renderStudent(user).catch((error) => showMessage("#dashboard-message", friendlyError(error), true)); }
  else { document.body.classList.remove("dashboard-mode"); dashboard.style.display = "none"; currentPayment = null; }
});

// Free starter quizzes. Replace questions with your lesson-based tests as course content is prepared.
const dailyQuestionSets = [
  { id: "day1", title: "Day 1 · Marketing Basics", questions: [
    { q: "What is a target audience?", options: ["People a business wants to reach", "A logo style", "An ad platform"], answer: 0 },
    { q: "A buyer persona is…", options: ["A fictional profile of a target customer", "A social media post", "An ad budget"], answer: 0 }
  ] },
  { id: "day2", title: "Day 2 · SEO & Content", questions: [
    { q: "What is the main purpose of SEO?", options: ["Improve organic visibility in search", "Send invoices", "Design a logo"], answer: 0 },
    { q: "Keyword research helps identify…", options: ["What people search for", "A site's colors", "A customer's password"], answer: 0 }
  ] },
  { id: "day3", title: "Day 3 · Social Media", questions: [
    { q: "A content calendar helps a team…", options: ["Plan and schedule content", "Approve bank payments", "Build a website domain"], answer: 0 },
    { q: "Engagement includes…", options: ["Likes, comments and shares", "Only ad spend", "Page load speed"], answer: 0 }
  ] },
  { id: "day4", title: "Day 4 · Ads & Analytics", questions: [
    { q: "Which metric counts clicks divided by impressions?", options: ["CTR", "Bounce rate", "CPC"], answer: 0 },
    { q: "A conversion is…", options: ["A desired user action", "An image format", "A keyword list"], answer: 0 }
  ] }
];
const finalQuestions = [
  { q: "What does SEO mainly aim to improve?", options: ["Organic search visibility", "Email delivery", "Video resolution"], answer: 0 },
  { q: "What is a conversion?", options: ["A desired action by a user", "A keyword list", "A website color"], answer: 0 },
  { q: "Which metric is clicks divided by impressions?", options: ["CTR", "CPA", "ROAS"], answer: 0 },
  { q: "Why use audience research?", options: ["Understand customer needs", "Increase image size", "Remove analytics"], answer: 0 },
  { q: "What is A/B testing used for?", options: ["Compare variations", "Schedule a domain", "Compress a PDF"], answer: 0 }
];function quizMarkup(questions, title, quizId) { return `<form class="quiz-form" data-quiz="${quizId}"><h3>${title}</h3>${questions.map((item, i) => `<fieldset><legend>${i + 1}. ${item.q}</legend>${item.options.map((option, j) => `<label><input type="radio" name="q${i}" value="${j}" required> ${option}</label>`).join("")}</fieldset>`).join("")}<button class="button" type="submit">Submit test</button><p class="quiz-result" aria-live="polite"></p></form>`; }
$("#daily-quiz").innerHTML = dailyQuestionSets.map((set) => quizMarkup(set.questions, set.title, set.id)).join("");
$("#final-quiz").innerHTML = quizMarkup(finalQuestions, "Final Exam · Starter Assessment", "final");
document.addEventListener("submit", (event) => {
  if (!event.target.matches(".quiz-form")) return;
  event.preventDefault(); const data = new FormData(event.target); const questions = event.target.dataset.quiz === "final" ? finalQuestions : dailyQuestionSets.find((set) => set.id === event.target.dataset.quiz)?.questions || [];
  let score = 0; questions.forEach((question, index) => { if (Number(data.get("q" + index)) === question.answer) score++; });
  event.target.querySelector(".quiz-result").textContent = `Your score: ${score} / ${questions.length}. Review the notes and try again to improve.`;
});
$("#download-notes").addEventListener("click", () => {
  const notes = "DISA DIGITAL AGENCY · DIGITAL MARKETING STARTER NOTES\n\n1. Strategy: define a target audience, goal and offer.\n2. SEO: make useful pages easy for search engines and people to find.\n3. Content: publish helpful content consistently.\n4. Social: choose platforms where your audience spends time.\n5. Paid ads: test audiences and creatives with a controlled budget.\n6. Email: build permission-based lists and send relevant messages.\n7. Analytics: track clicks, leads, conversions and cost per result.\n\nCourse-specific lesson notes can be added here as you prepare them.\n";
  const blob = new Blob([notes], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "disa-digital-marketing-notes.txt"; link.click(); URL.revokeObjectURL(url);
});







