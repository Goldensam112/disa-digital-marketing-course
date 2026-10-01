<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Disa Study | Professional Digital Learning</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--ink:#151426;--muted:#67667d;--purple:#5e3cee;--violet:#9d85ff;--lime:#d4ff59;--paper:#fbfaff;--line:#ebe7f5;--white:#fff;--shadow:0 18px 50px rgba(40,24,105,0.08)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;color:var(--ink);font-family:'DM Sans',sans-serif;background:var(--paper)}
a{color:inherit;text-decoration:none}
button,input,select,textarea{font:inherit}
.container{width:min(1160px,calc(100% - 40px));margin:auto}

/* HEADER & NAVBAR */
.nav-wrap{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:99}
.nav{height:76px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:12px;font-family:Manrope,sans-serif;font-weight:900;font-size:20px;letter-spacing:-.4px}
.brand-mark{width:42px;height:42px;border-radius:12px;background:var(--purple);color:#fff;display:grid;place-items:center;font-size:22px;box-shadow:0 8px 18px #5e3cee3b}
.navlinks{display:flex;gap:30px;align-items:center;color:#49485f;font-size:14px;font-weight:600}
.nav-actions{display:flex;gap:10px;align-items:center}
.button{border:0;border-radius:12px;background:var(--purple);color:#fff;font-weight:700;padding:12px 20px;display:inline-flex;gap:8px;align-items:center;justify-content:center;cursor:pointer;transition:.2s;box-shadow:0 8px 20px #5e3cee30}
.button:hover{transform:translateY(-2px);box-shadow:0 12px 26px #5e3cee40}
.button.secondary{background:#f1edff;color:var(--purple);box-shadow:none}

/* HERO SECTION */
.hero{padding:60px 0 80px}
.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:#f0ebff;color:var(--purple);border-radius:99px;font-size:12px;font-weight:800;text-transform:uppercase}
.hero h1{font:900 clamp(38px,5.5vw,64px)/1.08 Manrope,sans-serif;margin:18px 0;letter-spacing:-2.5px}
.hero h1 em{font-style:normal;color:var(--purple)}
.hero-copy{font-size:17px;line-height:1.7;color:var(--muted);max-width:540px}

/* FORM & ENROLLMENT */
.enroll-section{padding:80px 0;background:#fff;border-top:1px solid var(--line)}
.enroll-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:50px;align-items:start}
.form-card{background:#fff;border:1px solid var(--line);border-radius:24px;padding:34px;box-shadow:var(--shadow)}
.form-card h3{font:800 24px Manrope;margin:0 0 8px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.field{display:flex;flex-direction:column;gap:6px}
.field.full{grid-column:1/-1}
.field label{font-size:13px;font-weight:700}
.field input,.field select,.field textarea{border:1px solid #e1ddec;border-radius:10px;padding:12px;outline:none;background:#faf9fe}
.payment-step{display:none;margin-top:20px;padding:20px;background:#fbfaff;border-radius:16px;border:1px solid var(--line)}
.payment-qr{width:180px;height:180px;border-radius:12px;border:1px solid var(--line);padding:6px;background:#fff}

/* DASHBOARD & ID CARD */
.dashboard-mode>header,.dashboard-mode>main,.dashboard-mode>.enroll-section,.dashboard-mode>footer{display:none!important}
.dashboard-screen{min-height:100vh;padding:40px 0 80px;background:#f7f6fc}
.dash-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
.dash-header h1{font:800 32px Manrope;margin:4px 0}
.status-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:26px;box-shadow:var(--shadow);margin-bottom:20px}
.status-pill{display:inline-block;background:#efeaff;color:var(--purple);padding:6px 12px;border-radius:99px;font-size:11px;font-weight:800}
.dash-actions{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap}

/* LOGIN MODAL */
.login-backdrop{position:fixed;inset:0;background:#131124a8;z-index:999;place-items:center;padding:20px;display:none}
.login-card{background:#fff;width:min(420px,100%);border-radius:20px;padding:32px;box-shadow:var(--shadow);position:relative}

/* FOOTER */
.footer{background:#151426;color:#fff;padding:45px 0}
.footer-inner{display:flex;justify-content:space-between;align-items:center;gap:20px}
.footer-brand{font-size:18px;font-weight:800}

@media(max-width:768px){
  .hero-grid,.enroll-grid{grid-template-columns:1fr}
  .form-grid{grid-template-columns:1fr}
  .field.full{grid-column:auto}
  .navlinks{display:none}
}
</style>
</head>
<body>

<header class="nav-wrap">
  <div class="container nav">
    <a class="brand" href="#top"><span class="brand-mark">D</span><span>Disa Study</span></a>
    <nav class="navlinks">
      <a href="#course">Modules</a>
      <a href="#benefits">Why Us</a>
      <a href="#enroll">Course Enrollment</a>
    </nav>
    <div class="nav-actions">
      <button class="button secondary" id="student-login-open" type="button">Student Portal</button>
      <a class="button" href="#enroll">Enroll Now ₹799</a>
    </div>
  </div>
</header>

<main id="top">
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <span class="eyebrow">✦ Official Learning Platform</span>
        <h1>Master digital skills with <em>Disa Study.</em></h1>
        <p class="hero-copy">Comprehensive, real-world practical training designed to give you industry-ready capabilities and a verified student certification.</p>
        <div style="margin-top:24px;display:flex;gap:14px">
          <a class="button" href="#enroll">Start Course Today →</a>
        </div>
      </div>
      <div>
        <div style="background:#fff;border-radius:24px;padding:30px;border:1px solid var(--line);box-shadow:var(--shadow);text-align:center">
          <div style="font-size:42px;font-weight:900;color:var(--purple);font-family:Manrope">₹799</div>
          <p style="color:var(--muted);margin:6px 0 16px">Complete Digital Marketing Certification</p>
          <div style="font-size:13px;color:#3e8c3b;font-weight:700">✓ Instant Automated Student ID Card included</div>
        </div>
      </div>
    </div>
  </section>

  <section class="enroll-section" id="enroll">
    <div class="container enroll-grid">
      <div>
        <h2>Begin your enrollment</h2>
        <p style="color:var(--muted);line-height:1.7">Join Disa Study. Fill in your details below to generate your student profile and access your study portal immediately.</p>
      </div>
      <div class="form-card">
        <h3>Student Registration</h3>
        <p style="font-size:13px;color:var(--muted);margin-bottom:18px">Already enrolled? <button id="open-login-from-form" type="button" style="background:none;border:none;color:var(--purple);font-weight:700;cursor:pointer">Log in here</button></p>
        <form id="enrollment-form">
          <div class="form-grid">
            <div class="field"><label for="name">Full Name *</label><input id="name" name="name" placeholder="Your name" required></div>
            <div class="field"><label for="mobile">Mobile Number *</label><input id="mobile" name="mobile" placeholder="10-digit mobile" pattern="[6-9][0-9]{9}" required></div>
            <div class="field"><label for="email">Email Address *</label><input id="email" name="email" type="email" placeholder="you@domain.com" required></div>
            <div class="field"><label for="city">City *</label><input id="city" name="city" placeholder="Your City" required></div>
            <div class="field full"><label for="password">Create Portal Password *</label><input id="password" name="password" type="password" minlength="8" placeholder="Minimum 8 characters" required></div>
            <div class="field full"><label for="education">Current Education / Profession *</label><select id="education" name="education" required><option value="" disabled selected>Select</option><option>Student</option><option>Job Professional</option><option>Freelancer / Business</option></select></div>
          </div>
          <button class="button" type="submit" style="width:100%;margin-top:16px">Proceed to Payment →</button>
          
          <div class="payment-step" id="payment-step">
            <h4>UPI Payment (₹799)</h4>
            <p style="font-size:13px;color:var(--muted)">Scan using any UPI App or tap to open:</p>
            <div style="display:flex;gap:20px;align-items:center;margin:14px 0">
              <img id="payment-qr" class="payment-qr" alt="Disa Study QR">
              <div>
                <div style="font-weight:800;font-size:14px" class="upi-id">samtiwar06@axl</div>
                <div style="margin-top:10px;display:flex;gap:8px">
                  <a class="button" id="pay-upi" href="#">Open UPI App</a>
                  <button type="button" class="button secondary" id="copy-upi">Copy ID</button>
                </div>
              </div>
            </div>
            <div class="field"><label for="utr">Enter UTR / Transaction Reference *</label><input id="utr" placeholder="12-digit UPI reference"></div>
            <label style="display:flex;gap:8px;font-size:12px;margin:12px 0"><input type="checkbox" id="paid-confirm"> I have completed this transaction</label>
            <button class="button" id="send-whatsapp" type="button" style="width:100%">Verify & Unlock Course →</button>
          </div>
          <div id="form-success" class="success" style="display:none;margin-top:14px"></div>
        </form>
      </div>
    </div>
  </section>
</main>

<!-- STUDENT DASHBOARD -->
<section id="dashboard-screen" class="dashboard-screen" style="display:none">
  <div class="container">
    <div class="dash-header">
      <div>
        <span class="status-pill">Disa Study Portal</span>
        <h1>Welcome, <span id="dashboard-name">Student</span></h1>
      </div>
      <button class="button secondary" id="signout-button" type="button">Sign Out</button>
    </div>
    
    <div id="student-panel">
      <div class="status-card">
        <span id="status-pill" class="status-pill"></span>
        <p id="status-copy" style="margin-top:10px;color:var(--muted)"></p>
        <div class="dash-actions">
          <!-- INSTANT ID CARD BUTTON -->
          <button id="id-card-btn" class="button" type="button" style="display:none">🪪 Download Student ID Card</button>
        </div>
      </div>

      <div id="course-content" style="display:none">
        <div class="status-card">
          <h2>Disa Study Modules</h2>
          <p>Access your complete marketing course syllabus and resources.</p>
        </div>
      </div>
    </div>

    <div id="admin-panel" style="display:none">
      <div class="status-card">
        <h2>Disa Study Admin Console</h2>
        <div id="admin-requests"></div>
      </div>
    </div>
  </div>
</section>

<!-- LOGIN MODAL -->
<div id="login-modal" class="login-backdrop">
  <div class="login-card">
    <button id="login-close" style="float:right;border:none;background:none;font-size:22px;cursor:pointer">×</button>
    <div style="font-weight:900;color:var(--purple)">Disa Study</div>
    <h2 style="margin:8px 0 16px">Student Login</h2>
    <form id="login-form">
      <div class="field" style="margin-bottom:12px"><label>Email Address</label><input id="login-email" type="email" required></div>
      <div class="field" style="margin-bottom:16px"><label>Password</label><input id="login-password" type="password" required></div>
      <div id="login-message" style="display:none;margin-bottom:10px;font-size:13px;color:red"></div>
      <button class="button" type="submit" style="width:100%">Sign In</button>
    </form>
  </div>
</div>

<footer class="footer">
  <div class="container footer-inner">
    <div>
      <div class="footer-brand">Disa Study</div>
      <small style="color:#8e8b9f">© <span id="year"></span> Disa Study. All rights reserved.</small>
    </div>
    <div style="font-size:13px;color:#bdb9ce">Official Support: +91 96309 58789</div>
  </div>
</footer>

<script type="module" src="./app.js"></script>
</body>
</html>
