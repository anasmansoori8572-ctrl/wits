# Wits Lingo Academy — Official Web Platform

Welcome to the official repository for **[Wits Lingo Academy](https://www.witslingo.com)**.

## Project Overview
Wits Lingo is an online English language training academy platform providing spoken English masterclasses, personalized 1-on-1 coaching, interactive batch lessons, and verified certification.

- **Website:** [witslingo.com](https://www.witslingo.com)
- **Repository Owner:** [Anas Mansoori](https://github.com/anasmansoori8572-ctrl)
- **Stack:** React 19, TypeScript, Tailwind CSS, Express, Razorpay Gateway, Meta WhatsApp Cloud API, Backblaze B2 Storage.

---

## Getting Started

### 1. Prerequisites
- **Node.js** (v18, v20, or v22+)
- **npm** (v9+)

### 2. Installation
```bash
# Clone repository
git clone https://github.com/anasmansoori8572-ctrl/wits.git

# Enter project directory
cd wits

# Install all dependencies
npm install
```

### 3. Running Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Any edits in `src/` will hot-reload automatically.

### 4. Production Build
```bash
npm run build
```

---

## UI Component Architecture
For collaborators working on frontend & design improvements, all UI modules are organized inside `src/components/`:

- `src/components/Navbar.tsx` — Header navigation, brand logo, and portal links
- `src/components/Hero.tsx` — Main landing hero banner with CTA
- `src/components/CoursesSection.tsx` — Course catalog, fee details, and syllabus modals
- `src/components/CheckoutModal.tsx` — Express checkout & Razorpay payment window
- `src/components/AdmissionModal.tsx` — Comprehensive student registration form
- `src/components/TestimonialsSection.tsx` — Student success stories & video reviews
- `src/components/Footer.tsx` — Footer links, legal disclosures, and trust badges
- `src/components/PolicyPages.tsx` — RBI & Razorpay compliant Terms, Privacy, and Refund policies
- `src/index.css` — Global Tailwind CSS styles

---

## Deployment
This repository is connected directly to **Vercel**. Every push to the `main` branch automatically triggers a production build and deployment to [witslingo.com](https://www.witslingo.com).

© 2026 Wits Lingo Academy. All rights reserved.
