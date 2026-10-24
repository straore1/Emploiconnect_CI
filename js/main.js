// js/main.js - Logique principale, recherche, filtres, favoris et interactions pour EmploiConnect CI

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileMenu();
    initBackToTop();
    renderHeaderNav();

    // Check if on home page
    if (document.getElementById('recent-jobs-container')) {
        renderFeaturedJobs();
        renderCategoriesGrid();
        renderPartners();
        renderTestimonials();
        initHomeSearch();
    }

    // Check if on offers page
    if (document.getElementById('all-jobs-container')) {
        initOffersPage();
    }

    // Check if on detail offer page
    if (document.getElementById('job-detail-container')) {
        initJobDetailPage();
    }

    // Check if on favorites page (if any) or shared features
});

// Toast notification function
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fas fa-check-circle" style="color:var(--accent-green)"></i>' : '<i class="fas fa-exclamation-circle" style="color:#dc3545"></i>';
    toast.innerHTML = `${icon} <span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// XSS protection
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('emploiconnect_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        updateThemeIcon(savedTheme);
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('emploiconnect_theme', next);
            updateThemeIcon(next);
        });
    }
}

function updateThemeIcon(theme) {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

// Mobile menu
function initMobileMenu() {
    const btn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (btn && navLinks) {
        btn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            btn.innerHTML = navLinks.classList.contains('active') ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
    }
}

// Back to top button
function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Favorites management in localStorage
function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem('emploiconnect_favorites')) || [];
    } catch(e) {
        return [];
    }
}

function toggleFavorite(jobId) {
    let favs = getFavorites();
    const index = favs.indexOf(jobId);
    if (index > -1) {
        favs.splice(index, 1);
        showToast("Offre retirée de vos favoris", "success");
    } else {
        favs.push(jobId);
        showToast("Offre ajoutée à vos favoris (sauvegardé localement)", "success");
    }
    localStorage.setItem('emploiconnect_favorites', JSON.stringify(favs));
    
    // Update UI buttons
    document.querySelectorAll(`.favorite-btn[data-id="${jobId}"]`).forEach(btn => {
        btn.classList.toggle('active', favs.includes(jobId));
        btn.innerHTML = favs.includes(jobId) ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    });
}

// Helper to render a job card HTML safely
function createJobCardHTML(job) {
    const favs = getFavorites();
    const isFav = favs.includes(job.id);
    const initials = job.company.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
    
    return `
        <div class="job-card">
            <div>
                <div class="job-card-header">
                    <div class="job-company-logo">${escapeHTML(initials)}</div>
                    <button class="favorite-btn ${isFav ? 'active' : ''}" data-id="${job.id}" onclick="toggleFavorite(${job.id})" title="Ajouter aux favoris">
                        <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                </div>
                <h3 class="job-title"><a href="detail-offre.html?id=${job.id}">${escapeHTML(job.title)}</a></h3>
                <p class="job-company"><i class="fas fa-building"></i> ${escapeHTML(job.company)} - <i class="fas fa-map-marker-alt" style="color:var(--accent-color)"></i> ${escapeHTML(job.city)} (${escapeHTML(job.quartier)})</p>
                
                <div class="job-tags">
                    <span class="tag contract">${escapeHTML(job.contract)}</span>
                    <span class="tag"><i class="fas fa-briefcase"></i> ${escapeHTML(job.experience)}</span>
                    <span class="tag"><i class="fas fa-graduation-cap"></i> ${escapeHTML(job.category)}</span>
                </div>
            </div>
            
            <div class="job-footer">
                <div>
                    <div class="job-salary">${escapeHTML(job.salary)}</div>
                    <div class="job-date">Publié le ${escapeHTML(job.date)}</div>
                </div>
                <a href="detail-offre.html?id=${job.id}" class="btn btn-outline btn-sm">Voir l'offre</a>
            </div>
        </div>
    `;
}

// Home page renderers
function renderFeaturedJobs() {
    const container = document.getElementById('recent-jobs-container');
    if (!container) return;
    
    // Get combined demo offers + user published local offers from localStorage
    const allOffers = getAllOffers();
    const recent = allOffers.slice(0, 6); // Top 6
    
    container.innerHTML = recent.map(job => createJobCardHTML(job)).join('');
}

function renderCategoriesGrid() {
    const container = document.getElementById('categories-grid');
    if (!container) return;
    
    const allOffers = getAllOffers();
    const categories = [
        { name: "Informatique et développement web", icon: "fas fa-laptop-code" },
        { name: "Comptabilité et finance", icon: "fas fa-calculator" },
        { name: "Commerce et vente", icon: "fas fa-chart-line" },
        { name: "Transport et logistique", icon: "fas fa-truck" },
        { name: "Ressources humaines", icon: "fas fa-users" },
        { name: "Marketing et communication", icon: "fas fa-bullhorn" },
        { name: "Administration", icon: "fas fa-folder-open" },
        { name: "Hôtellerie et restauration", icon: "fas fa-concierge-bell" },
        { name: "Stages et emplois débutants", icon: "fas fa-graduation-cap" },
        { name: "Métiers techniques et artisanaux", icon: "fas fa-tools" }
    ];
    
    container.innerHTML = categories.map(cat => {
        const count = allOffers.filter(o => o.category === cat.name).length;
        return `
            <div class="category-card" onclick="location.href='offres.html?cat=${encodeURIComponent(cat.name)}'">
                <i class="${cat.icon}"></i>
                <h3>${escapeHTML(cat.name)}</h3>
                <span>${count} offre(s) disponible(s)</span>
            </div>
        `;
    }).join('');
}

function renderPartners() {
    const container = document.getElementById('partners-scroll');
    if (!container) return;
    container.innerHTML = DEMO_COMPANIES.map(p => `
        <div class="partner-badge">
            <span>${p.logo}</span>
            <div>
                <strong>${escapeHTML(p.name)}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHTML(p.sector)}</div>
            </div>
        </div>
    `).join('');
}

function renderTestimonials() {
    const container = document.getElementById('testimonials-grid');
    if (!container) return;
    container.innerHTML = DEMO_TESTIMONIALS.map(t => `
        <div class="testimonial-card">
            <p>"${escapeHTML(t.text)}"</p>
            <div class="testimonial-author">
                <h4>${escapeHTML(t.name)}</h4>
                <span>${escapeHTML(t.role)}</span>
            </div>
        </div>
    `).join('');
}

function initHomeSearch() {
    const btn = document.getElementById('home-search-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const keyword = document.getElementById('search-keyword').value;
        const city = document.getElementById('search-city').value;
        const category = document.getElementById('search-category').value;
        
        const params = new URLSearchParams();
        if (keyword) params.set('q', keyword);
        if (city) params.set('city', city);
        if (category) params.set('cat', category);
        
        window.location.href = `offres.html?${params.toString()}`;
    });
}

// Get all offers (DEMO_OFFRES + localStorage published offers)
function getAllOffers() {
    let customOffers = [];
    try {
        customOffers = JSON.parse(localStorage.getItem('emploiconnect_custom_offers')) || [];
    } catch(e) {
        customOffers = [];
    }
    // Combine both, custom first
    return [...customOffers, ...DEMO_OFFRES];
}

// Offers page filtering and searching
function initOffersPage() {
    const container = document.getElementById('all-jobs-container');
    const countSpan = document.getElementById('results-count');
    const searchInput = document.getElementById('filter-search');
    const citySelect = document.getElementById('filter-city');
    const catSelect = document.getElementById('filter-category');
    const contractSelect = document.getElementById('filter-contract');
    const sortSelect = document.getElementById('filter-sort');
    const resetBtn = document.getElementById('reset-filters');
    
    // Parse URL params if any
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('q') && searchInput) searchInput.value = urlParams.get('q');
    if (urlParams.get('city') && citySelect) citySelect.value = urlParams.get('city');
    if (urlParams.get('cat') && catSelect) catSelect.value = urlParams.get('cat');
    
    function applyFilters() {
        let offers = getAllOffers();
        
        const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const city = citySelect ? citySelect.value : '';
        const cat = catSelect ? catSelect.value : '';
        const contract = contractSelect ? contractSelect.value : '';
        const sort = sortSelect ? sortSelect.value : 'recent';
        
        if (q) {
            offers = offers.filter(o => 
                o.title.toLowerCase().includes(q) || 
                o.company.toLowerCase().includes(q) || 
                o.description.toLowerCase().includes(q) ||
                o.skills.some(s => s.toLowerCase().includes(q))
            );
        }
        if (city) {
            offers = offers.filter(o => o.city === city);
        }
        if (cat) {
            offers = offers.filter(o => o.category === cat);
        }
        if (contract) {
            offers = offers.filter(o => o.contract === contract);
        }
        
        // Sorting
        if (sort === 'recent') {
            offers.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else if (sort === 'oldest') {
            offers.sort((a, b) => new Date(a.date) - new Date(b.date));
        } else if (sort === 'title') {
            offers.sort((a, b) => a.title.localeCompare(b.title));
        }
        
        // Render
        if (countSpan) countSpan.textContent = `${offers.length} offre(s) trouvée(s)`;
        
        if (offers.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border-color);">
                    <i class="fas fa-search" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;">}</i>
                    <h3>Aucune offre ne correspond à vos critères</h3>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">Essayez de modifier vos filtres ou d'élargir votre recherche.</p>
                </div>
            `;
        } else {
            container.innerHTML = offers.map(o => createJobCardHTML(o)).join('');
        }
    }
    
    [searchInput, citySelect, catSelect, contractSelect, sortSelect].forEach(el => {
        if (el) {
            el.addEventListener('input', applyFilters);
            el.addEventListener('change', applyFilters);
        }
    });
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (citySelect) citySelect.value = '';
            if (catSelect) catSelect.value = '';
            if (contractSelect) contractSelect.value = '';
            if (sortSelect) sortSelect.value = 'recent';
            applyFilters();
            showToast("Filtres réinitialisés", "success");
        });
    }
    
    applyFilters();
}

// Job detail page
function initJobDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = parseInt(urlParams.get('id'));
    const container = document.getElementById('job-detail-container');
    
    if (!id || !container) {
        container.innerHTML = "<p>Offre introuvable.</p>";
        return;
    }
    
    const allOffers = getAllOffers();
    const job = allOffers.find(o => o.id === id);
    
    if (!job) {
        container.innerHTML = "<p>Cette offre n'existe plus ou a été retirée.</p>";
        return;
    }
    
    const favs = getFavorites();
    const isFav = favs.includes(job.id);
    
    container.innerHTML = `
        <div style="background: var(--card-bg); padding: 2.5rem; border-radius: var(--radius); border: 1px solid var(--border-color); box-shadow: var(--shadow);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
                <div>
                    <span class="tag contract" style="margin-bottom: 0.5rem; display: inline-block;">${escapeHTML(job.contract)}</span>
                    <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">${escapeHTML(job.title)}</h1>
                    <p style="font-size: 1.1rem; color: var(--text-muted);"><i class="fas fa-building"></i> ${escapeHTML(job.company)} | <i class="fas fa-map-marker-alt" style="color:var(--accent-color)"></i> ${escapeHTML(job.city)} (${escapeHTML(job.quartier)})</p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" data-id="${job.id}" onclick="toggleFavorite(${job.id})" style="font-size: 1.5rem; background: var(--bg-color); padding: 0.5rem 1rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
                        <i class="${isFav ? 'fas' : 'far'} fa-heart"></i> ${isFav ? 'Favoris' : 'Enregistrer'}
                    </button>
                    <button onclick="copyJobLink()" class="btn btn-outline" style="padding: 0.5rem 1rem;">
                        <i class="fas fa-share-alt"></i> Partager
                    </button>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: var(--bg-color); padding: 1.25rem; border-radius: var(--radius); margin-bottom: 2rem; border: 1px solid var(--border-color);">
                <div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Rémunération</div>
                    <div style="font-weight:700; color:var(--accent-green); font-size:1.1rem;">${escapeHTML(job.salary)}</div>
                </div>
                <div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Expérience requise</div>
                    <div style="font-weight:600;">${escapeHTML(job.experience)}</div>
                </div>
                <div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Niveau d'études</div>
                    <div style="font-weight:600;">${escapeHTML(job.education)}</div>
                </div>
                <div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Date de publication</div>
                    <div style="font-weight:600;">${escapeHTML(job.date)}</div>
                </div>
            </div>

            <h3 style="margin-bottom: 0.75rem; font-size: 1.25rem;">Description du poste</h3>
            <p style="margin-bottom: 2rem; color: var(--text-color);">${escapeHTML(job.description)}</p>

            <h3 style="margin-bottom: 0.75rem; font-size: 1.25rem;">Missions principales</h3>
            <ul style="margin-bottom: 2rem; padding-left: 1.5rem; list-style: disc;">
                ${job.missions.map(m => `<li style="margin-bottom: 0.5rem;">${escapeHTML(m)}</li>`).join('')}
            </ul>

            <h3 style="margin-bottom: 0.75rem; font-size: 1.25rem;">Compétences recherchées</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem;">
                ${job.skills.map(s => `<span class="tag" style="background: var(--primary-light); color: var(--primary-color); font-weight:600;">${escapeHTML(s)}</span>`).join('')}
            </div>

            <h3 style="margin-bottom: 0.75rem; font-size: 1.25rem;">Profil recherché</h3>
            <p style="margin-bottom: 2.5rem; color: var(--text-color);">${escapeHTML(job.profile)}</p>

            <div style="background: var(--primary-light); padding: 2rem; border-radius: var(--radius); text-align: center; border: 1px solid var(--primary-color);">
                <h3 style="margin-bottom: 0.5rem; color: var(--text-color);">Intéressé(e) par cette opportunité ?</h3>
                <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Postulez directement en envoyant votre dossier de candidature ou contactez le recruteur.</p>
                <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
                    <button onclick="openApplyModal('${escapeHTML(job.title)}', '${escapeHTML(job.company)}')" class="btn btn-primary">
                        <i class="fas fa-paper-plane"></i> Postuler maintenant
                    </button>
                    <a href="mailto:${job.contactEmail}?subject=Candidature - ${encodeURIComponent(job.title)}" class="btn btn-outline">
                        <i class="fas fa-envelope"></i> ${escapeHTML(job.contactEmail)}
                    </a>
                </div>
            </div>
        </div>
    `;
}

function copyJobLink() {
    navigator.clipboard.writeText(window.location.href);
    showToast("Lien de l'offre copié dans le presse-papier !", "success");
}

function openApplyModal(title, company) {
    let modal = document.getElementById('apply-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'apply-modal';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:10000; padding:1rem;";
        modal.innerHTML = `
            <div style="background:var(--card-bg); padding:2rem; border-radius:var(--radius); max-width:600px; width:100%; box-shadow:var(--shadow-lg); border:1px solid var(--border-color); position:relative;">
                <button onclick="document.getElementById('apply-modal').remove()" style="position:absolute; top:1rem; right:1rem; background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">&times;</button>
                <h2 style="margin-bottom:0.5rem;">Candidature</h2>
                <p id="modal-subtitle" style="color:var(--text-muted); margin-bottom:1.5rem; font-size:0.95rem;"></p>
                
                <form id="quick-apply-form" onsubmit="handleQuickApply(event)">
                    <div class="form-group">
                        <label>Nom et Prénom *</label>
                        <input type="text" id="qa-name" required placeholder="Ex: Kouassi Jean">
                    </div>
                    <div class="form-group">
                        <label>Adresse e-mail *</label>
                        <input type="email" id="qa-email" required placeholder="Ex: jean.kouassi@gmail.com">
                    </div>
                    <div class="form-group">
                        <label>Téléphone *</label>
                        <input type="tel" id="qa-phone" required placeholder="Ex: +225 07 00 00 00 00">
                    </div>
                    <div class="form-group">
                        <label>Votre CV (PDF ou DOCX, max 5 Mo) *</label>
                        <input type="file" id="qa-cv" accept=".pdf,.docx" required>
                        <small style="color:var(--text-muted); font-size:0.8rem;">Le fichier reste strictement local sur votre navigateur.</small>
                    </div>
                    <div class="form-group">
                        <label>Message de motivation (optionnel)</label>
                        <textarea id="qa-msg" placeholder="Quelques mots pour vous présenter..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">Envoyer ma candidature (Simulation Locale)</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('modal-subtitle').textContent = `Postuler à : ${title} chez ${company}`;
    modal.style.display = 'flex';
}

function handleQuickApply(e) {
    e.preventDefault();
    const name = document.getElementById('qa-name').value;
    const email = document.getElementById('qa-email').value;
    const cvInput = document.getElementById('qa-cv');
    
    if (cvInput.files.length > 0) {
        const file = cvInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
            showToast("Le fichier CV dépasse la taille maximale de 5 Mo.", "error");
            return;
        }
    }
    
    showToast(`Candidature envoyée avec succès pour ${name} (${email}) ! (Simulé en local)`, "success");
    document.getElementById('apply-modal').remove();
}

function renderHeaderNav() {
    // Optional dynamic adjustments if needed
}
