// js/forms.js - Validation et gestion des formulaires (Candidat, Recruteur, Contact)

document.addEventListener('DOMContentLoaded', () => {
    initCandidateForm();
    initRecruiterForm();
    initContactForm();
});

// Candidate Profile Form
function initCandidateForm() {
    const form = document.getElementById('candidate-profile-form');
    if (!form) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('cand-name').value.trim();
        const email = document.getElementById('cand-email').value.trim();
        const phone = document.getElementById('cand-phone').value.trim();
        const city = document.getElementById('cand-city').value;
        const jobTitle = document.getElementById('cand-job').value.trim();
        const skills = document.getElementById('cand-skills').value.trim();
        const education = document.getElementById('cand-education').value;
        const experience = document.getElementById('cand-exp').value;
        const bio = document.getElementById('cand-bio').value.trim();
        const cvInput = document.getElementById('cand-cv');
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast("Veuillez entrer une adresse e-mail valide.", "error");
            return;
        }
        
        // File validation
        let cvFileName = "Aucun CV joint";
        if (cvInput && cvInput.files.length > 0) {
            const file = cvInput.files[0];
            if (file.size > 5 * 1024 * 1024) {
                showToast("Le fichier CV ne doit pas dépasser 5 Mo.", "error");
                return;
            }
            cvFileName = file.name;
        }
        
        const profileData = {
            name, email, phone, city, jobTitle, skills, education, experience, bio, cvFileName,
            createdAt: new Date().toLocaleDateString('fr-FR')
        };
        
        // Save in localStorage securely as local profile demo
        localStorage.setItem('emploiconnect_candidate_profile', JSON.stringify(profileData));
        
        showToast("Profil candidat enregistré avec succès dans le stockage local !", "success");
        
        // Show preview modal or success alert
        showPreviewModal("Profil Candidat Enregistré", `
            <p><strong>Nom & Prénom :</strong> ${escapeHTML(profileData.name)}</p>
            <p><strong>E-mail :</strong> ${escapeHTML(profileData.email)}</p>
            <p><strong>Téléphone :</strong> ${escapeHTML(profileData.phone)}</p>
            <p><strong>Ville :</strong> ${escapeHTML(profileData.city)}</p>
            <p><strong>Métier recherché :</strong> ${escapeHTML(profileData.jobTitle)}</p>
            <p><strong>Compétences :</strong> ${escapeHTML(profileData.skills)}</p>
            <p><strong>Niveau d'études :</strong> ${escapeHTML(profileData.education)}</p>
            <p><strong>Expérience :</strong> ${escapeHTML(profileData.experience)}</p>
            <p><strong>CV local :</strong> ${escapeHTML(profileData.cvFileName)} (Stocké localement sur votre navigateur)</p>
        `);
    });
}

// Recruiter Offer Publication Form
function initRecruiterForm() {
    const form = document.getElementById('recruiter-offer-form');
    if (!form) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const companyName = document.getElementById('rec-company').value.trim();
        const title = document.getElementById('rec-title').value.trim();
        const category = document.getElementById('rec-category').value;
        const contract = document.getElementById('rec-contract').value;
        const city = document.getElementById('rec-city').value;
        const quartier = document.getElementById('rec-quartier').value.trim() || "Centre";
        const salary = document.getElementById('rec-salary').value.trim();
        const experience = document.getElementById('rec-exp').value;
        const education = document.getElementById('rec-edu').value.trim();
        const description = document.getElementById('rec-desc').value.trim();
        const missionsStr = document.getElementById('rec-missions').value.trim();
        const skillsStr = document.getElementById('rec-skills').value.trim();
        const profileReq = document.getElementById('rec-profile').value.trim();
        const contactEmail = document.getElementById('rec-email').value.trim();
        const contactPhone = document.getElementById('rec-phone').value.trim();
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
            showToast("Veuillez entrer une adresse e-mail de contact valide.", "error");
            return;
        }
        
        const missions = missionsStr ? missionsStr.split('\n').filter(m => m.trim() !== '') : ["Missions selon description"];
        const skills = skillsStr ? skillsStr.split(',').map(s => s.trim()) : ["Général"];
        
        const newOffer = {
            id: Date.now(), // Unique ID based on timestamp
            title,
            company: companyName,
            city,
            quartier,
            category,
            contract,
            salary: salary || "À négocier",
            experience: experience || "Non spécifié",
            education: education || "Non spécifié",
            date: new Date().toISOString().split('T')[0],
            description,
            missions,
            skills,
            profile: profileReq || "Profil motivé",
            contactEmail,
            contactPhone,
            featured: false
        };
        
        // Save in localStorage custom offers array
        let customOffers = [];
        try {
            customOffers = JSON.parse(localStorage.getItem('emploiconnect_custom_offers')) || [];
        } catch(e) {
            customOffers = [];
        }
        customOffers.unshift(newOffer); // Add to beginning
        localStorage.setItem('emploiconnect_custom_offers', JSON.stringify(customOffers));
        
        showToast("Offre publiée avec succès sur votre navigateur local !", "success");
        
        showPreviewModal("Offre Publiée (Mode Démo Local)", `
            <p><strong>Entreprise :</strong> ${escapeHTML(newOffer.company)}</p>
            <p><strong>Poste :</strong> ${escapeHTML(newOffer.title)}</p>
            <p><strong>Lieu :</strong> ${escapeHTML(newOffer.city)} (${escapeHTML(newOffer.quartier)})</p>
            <p><strong>Contrat :</strong> ${escapeHTML(newOffer.contract)} - ${escapeHTML(newOffer.salary)}</p>
            <p style="margin-top:1rem; color:var(--text-muted); font-size:0.9rem;">Cette offre est désormais visible dans la liste des offres de votre navigateur.</p>
            <div style="margin-top:1.5rem; text-align:center;">
                <a href="offres.html" class="btn btn-primary">Voir toutes les offres</a>
            </div>
        `);
        
        form.reset();
    });
}

// Contact Form
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const subject = document.getElementById('contact-subject').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast("Veuillez entrer une adresse e-mail valide.", "error");
            return;
        }
        
        showToast(`Merci ${name} ! Votre message a bien été pris en compte (Simulation locale).`, "success");
        form.reset();
    });
}

// Preview Modal utility
function showPreviewModal(title, htmlContent) {
    let modal = document.getElementById('preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'preview-modal';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:10000; padding:1rem;";
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div style="background:var(--card-bg); padding:2.5rem; border-radius:var(--radius); max-width:650px; width:100%; box-shadow:var(--shadow-lg); border:1px solid var(--border-color); position:relative; max-height:90vh; overflow-y:auto;">
            <button onclick="document.getElementById('preview-modal').remove()" style="position:absolute; top:1.25rem; right:1.25rem; background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">&times;</button>
            <h2 style="margin-bottom:1rem; color:var(--primary-color);">${escapeHTML(title)}</h2>
            <div style="margin-bottom:1.5rem; line-height:1.7;">
                ${htmlContent}
            </div>
            <button onclick="document.getElementById('preview-modal').remove()" class="btn btn-primary" style="width:100%;">Fermer</button>
        </div>
    `;
    modal.style.display = 'flex';
}
