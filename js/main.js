document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initMobileMenu();
    initBackToTop();
    renderHeaderNav();

    const client = await window.backendReady;
    await window.authReady;
    if (document.getElementById('recent-jobs-container')) {
        renderCategoriesGrid();
        initHomeSearch();
        await renderFeaturedJobs(client);
    }
    if (document.getElementById('all-jobs-container')) await initOffersPage(client);
    if (document.getElementById('job-detail-container')) await initJobDetailPage(client);
});

function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success'
        ? '<i class="fas fa-check-circle" style="color:var(--accent-green)"></i>'
        : '<i class="fas fa-exclamation-circle" style="color:#dc3545"></i>';
    toast.innerHTML = `${icon} <span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[character]);
}

function initTheme() {
    const savedTheme = readLocalPreference('emploiconnect_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    updateThemeIcon(savedTheme);
    toggle.addEventListener('click', () => {
        const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        writeLocalPreference('emploiconnect_theme', nextTheme);
        updateThemeIcon(nextTheme);
    });
}

function readLocalPreference(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.error('Impossible de lire les préférences locales.', error);
        return null;
    }
}

function writeLocalPreference(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        console.error('Impossible d’enregistrer les préférences locales.', error);
        showToast('Le navigateur ne permet pas d’enregistrer cette préférence.', 'error');
        return false;
    }
}

function updateThemeIcon(theme) {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.innerHTML = theme === 'dark'
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
}

function initMobileMenu() {
    const button = document.querySelector('.mobile-menu-btn');
    const links = document.querySelector('.nav-links');
    if (!button || !links) return;
    button.addEventListener('click', () => {
        links.classList.toggle('active');
        button.innerHTML = links.classList.contains('active')
            ? '<i class="fas fa-times"></i>'
            : '<i class="fas fa-bars"></i>';
    });
}

function initBackToTop() {
    const button = document.getElementById('back-to-top');
    if (!button) return;
    window.addEventListener('scroll', () => button.classList.toggle('visible', window.scrollY > 300));
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function renderHeaderNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(link => {
        if (link.getAttribute('href') === currentPage) link.classList.add('active');
    });
}

function getFavorites() {
    try {
        const favorites = JSON.parse(readLocalPreference('emploiconnect_favorites') || '[]');
        return Array.isArray(favorites) ? favorites : [];
    } catch (error) {
        console.error('Impossible de lire les favoris enregistrés.', error);
        return [];
    }
}

function toggleFavorite(jobId) {
    const favorites = getFavorites();
    const index = favorites.indexOf(jobId);
    if (index < 0) favorites.push(jobId);
    else favorites.splice(index, 1);
    if (!writeLocalPreference('emploiconnect_favorites', JSON.stringify(favorites))) return;
    document.querySelectorAll('.favorite-btn').forEach(button => {
        if (button.dataset.id !== jobId) return;
        const isFavorite = favorites.includes(jobId);
        button.classList.toggle('active', isFavorite);
        button.innerHTML = isFavorite
            ? '<i class="fas fa-heart"></i>'
            : '<i class="far fa-heart"></i>';
    });
    showToast(index < 0 ? 'Offre ajoutée à vos favoris.' : 'Offre retirée de vos favoris.');
}

function mapJob(row) {
    return {
        ...row,
        date: new Date(row.created_at).toLocaleDateString('fr-FR'),
        createdAt: row.created_at,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone
    };
}

async function getAllOffers(client) {
    if (!client) throw new Error('Le service des offres n’est pas configuré. Consultez README.md.');
    const { data, error } = await client
        .from('jobs')
        .select('id,title,company,city,quartier,category,contract,salary,experience,education,description,missions,skills,profile,contact_email,contact_phone,status,created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(mapJob);
}

function createJobCardHTML(job) {
    const isFavorite = getFavorites().includes(job.id);
    const initials = job.company.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
    return `
        <article class="job-card">
            <div>
                <div class="job-card-header">
                    <div class="job-company-logo">${escapeHTML(initials)}</div>
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${escapeHTML(job.id)}" onclick="toggleFavorite('${escapeHTML(job.id)}')" aria-label="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                        <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                </div>
                <h3 class="job-title"><a href="detail-offre.html?id=${encodeURIComponent(job.id)}">${escapeHTML(job.title)}</a></h3>
                <p class="job-company"><i class="fas fa-building"></i> ${escapeHTML(job.company)} · <i class="fas fa-map-marker-alt"></i> ${escapeHTML(job.city)} (${escapeHTML(job.quartier)})</p>
                <div class="job-tags">
                    <span class="tag contract">${escapeHTML(job.contract)}</span>
                    <span class="tag"><i class="fas fa-briefcase"></i> ${escapeHTML(job.experience)}</span>
                    <span class="tag"><i class="fas fa-graduation-cap"></i> ${escapeHTML(job.category)}</span>
                </div>
            </div>
            <div class="job-footer">
                <div><div class="job-salary">${escapeHTML(job.salary)}</div><div class="job-date">Publié le ${escapeHTML(job.date)}</div></div>
                <a href="detail-offre.html?id=${encodeURIComponent(job.id)}" class="btn btn-outline btn-sm">Voir l’offre</a>
            </div>
        </article>`;
}

function renderCategoriesGrid() {
    const container = document.getElementById('categories-grid');
    if (!container) return;
    const icons = [
        'fa-laptop-code', 'fa-calculator', 'fa-chart-line', 'fa-truck', 'fa-users',
        'fa-bullhorn', 'fa-folder-open', 'fa-concierge-bell', 'fa-graduation-cap', 'fa-tools'
    ];
    container.innerHTML = JOB_CATEGORIES.map((category, index) => `
        <a class="category-card" href="offres.html?cat=${encodeURIComponent(category)}" aria-label="Voir les offres du secteur ${escapeHTML(category)}">
            <i class="fas ${icons[index]}"></i>
            <h3>${escapeHTML(category)}</h3>
            <span>Voir les offres <i class="fas fa-arrow-right"></i></span>
        </a>
    `).join('');
}

async function renderFeaturedJobs(client) {
    const container = document.getElementById('recent-jobs-container');
    if (!container) return;
    try {
        const jobs = await getAllOffers(client);
        container.innerHTML = jobs.length
            ? jobs.slice(0, 6).map(createJobCardHTML).join('')
            : '<p>Aucune offre publiée pour le moment. Revenez bientôt pour découvrir les nouvelles opportunités.</p>';
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p role="alert">Impossible de charger les offres. Vérifiez la configuration Supabase.</p>';
    }
}

function initHomeSearch() {
    const form = document.getElementById('home-search-form');
    if (!form) return;
    form.addEventListener('submit', event => {
        event.preventDefault();
        const params = new URLSearchParams();
        const keyword = document.getElementById('search-keyword').value.trim();
        const city = document.getElementById('search-city').value;
        const category = document.getElementById('search-category').value;
        if (keyword) params.set('q', keyword);
        if (city) params.set('city', city);
        if (category) params.set('cat', category);
        const query = params.toString();
        window.location.href = query ? `offres.html?${query}` : 'offres.html';
    });
}

async function initOffersPage(client) {
    const container = document.getElementById('all-jobs-container');
    const count = document.getElementById('results-count');
    const search = document.getElementById('filter-search');
    const city = document.getElementById('filter-city');
    const category = document.getElementById('filter-category');
    const contract = document.getElementById('filter-contract');
    const sort = document.getElementById('filter-sort');
    const reset = document.getElementById('reset-filters');
    const params = new URLSearchParams(window.location.search);
    if (params.has('q')) search.value = params.get('q');
    if (params.has('city')) city.value = params.get('city');
    if (params.has('cat')) category.value = params.get('cat');

    let jobs;
    try {
        jobs = await getAllOffers(client);
    } catch (error) {
        console.error(error);
        count.textContent = 'Offres indisponibles';
        container.innerHTML = '<p role="alert">Impossible de charger les offres. Vérifiez la configuration Supabase.</p>';
        return;
    }

    function applyFilters() {
        const keyword = search.value.trim().toLocaleLowerCase('fr');
        let filtered = jobs.filter(job => {
            const searchable = [job.title, job.company, job.description, ...(job.skills || [])]
                .join(' ')
                .toLocaleLowerCase('fr');
            return (!keyword || searchable.includes(keyword))
                && (!city.value || job.city === city.value)
                && (!category.value || job.category === category.value)
                && (!contract.value || job.contract === contract.value);
        });
        if (sort.value === 'recent') filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        if (sort.value === 'oldest') filtered.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        if (sort.value === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
        count.textContent = `${filtered.length} offre(s) trouvée(s)`;
        container.innerHTML = filtered.length
            ? filtered.map(createJobCardHTML).join('')
            : '<p style="grid-column:1/-1;text-align:center;padding:3rem;">Aucune offre ne correspond à vos critères.</p>';
    }

    [search, city, category, contract, sort].forEach(element => {
        element.addEventListener('input', applyFilters);
        element.addEventListener('change', applyFilters);
    });
    reset.addEventListener('click', () => {
        search.value = '';
        city.value = '';
        category.value = '';
        contract.value = '';
        sort.value = 'recent';
        applyFilters();
    });
    applyFilters();
}

async function initJobDetailPage(client) {
    const container = document.getElementById('job-detail-container');
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        container.textContent = 'Offre introuvable.';
        return;
    }
    try {
        const { data, error } = await client
            .from('jobs')
            .select('id,title,company,city,quartier,category,contract,salary,experience,education,description,missions,skills,profile,contact_email,contact_phone,status,created_at')
            .eq('id', id)
            .eq('status', 'published')
            .maybeSingle();
        if (error) throw error;
        if (!data) {
            container.textContent = 'Cette offre n’existe plus ou a été retirée.';
            return;
        }
        renderJobDetail(container, mapJob(data));
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p role="alert">Impossible de charger cette offre. Vérifiez la configuration Supabase.</p>';
    }
}

function renderJobDetail(container, job) {
    const isFavorite = getFavorites().includes(job.id);
    container.innerHTML = `
        <article class="job-detail-card" style="background:var(--card-bg);padding:2.5rem;border-radius:var(--radius);border:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:2rem;">
                <div>
                    <span class="tag contract">${escapeHTML(job.contract)}</span>
                    <h1>${escapeHTML(job.title)}</h1>
                    <p>${escapeHTML(job.company)} · ${escapeHTML(job.city)} (${escapeHTML(job.quartier)})</p>
                </div>
                <div>
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${escapeHTML(job.id)}" onclick="toggleFavorite('${escapeHTML(job.id)}')">
                        <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i> ${isFavorite ? 'Favoris' : 'Enregistrer'}
                    </button>
                    <button onclick="copyJobLink()" class="btn btn-outline"><i class="fas fa-share-alt"></i> Partager</button>
                </div>
            </div>
            <div class="job-tags">
                <span class="tag">${escapeHTML(job.salary)}</span>
                <span class="tag">${escapeHTML(job.experience)}</span>
                <span class="tag">${escapeHTML(job.education)}</span>
                <span class="tag">Publié le ${escapeHTML(job.date)}</span>
            </div>
            <h2>Description du poste</h2><p>${escapeHTML(job.description)}</p>
            <h2>Missions principales</h2>
            <ul>${(job.missions || []).map(mission => `<li>${escapeHTML(mission)}</li>`).join('')}</ul>
            <h2>Compétences recherchées</h2>
            <div class="job-tags">${(job.skills || []).map(skill => `<span class="tag">${escapeHTML(skill)}</span>`).join('')}</div>
            <h2>Profil recherché</h2><p>${escapeHTML(job.profile)}</p>
            <div class="apply-callout" style="margin-top:2rem;padding:2rem;text-align:center;background:var(--primary-light);border-radius:var(--radius);">
                <h2>Intéressé(e) par cette opportunité ?</h2>
                <p>Postulez avec votre compte candidat. Votre CV sera partagé en privé avec ce recruteur.</p>
                <button onclick="openApplyModal('${escapeHTML(job.id)}')" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Postuler maintenant</button>
                <p style="margin-top:1rem;">Contacter le recruteur :
                    <a href="mailto:${escapeHTML(job.contactEmail)}?subject=${encodeURIComponent(`Candidature - ${job.title}`)}">${escapeHTML(job.contactEmail)}</a>
                    ${job.contactPhone ? ` · <a href="tel:${escapeHTML(job.contactPhone.replace(/[^\d+]/g, ''))}">${escapeHTML(job.contactPhone)}</a>` : ''}
                </p>
            </div>
        </article>`;
}

async function copyJobLink() {
    try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Lien de l’offre copié.');
    } catch (error) {
        console.error(error);
        showToast('Impossible de copier le lien. Copiez-le depuis la barre d’adresse.', 'error');
    }
}

async function openApplyModal(jobId) {
    await window.authReady;
    if (!window.currentUser || !window.currentProfile || window.currentProfile.role !== 'candidate') {
        showToast('Connectez-vous avec votre compte candidat pour postuler.', 'error');
        window.location.href = `candidat.html?redirect=${encodeURIComponent(window.location.href)}`;
        return;
    }
    if (!window.currentProfile.cv_path) {
        showToast('Ajoutez votre CV dans votre espace candidat avant de postuler.', 'error');
        window.location.href = 'candidat.html';
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'apply-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:1rem;';
    modal.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="apply-title" style="background:var(--card-bg);padding:2rem;border-radius:var(--radius);max-width:600px;width:100%;">
            <button type="button" data-close-modal aria-label="Fermer" style="float:right;">&times;</button>
            <h2 id="apply-title">Envoyer ma candidature</h2>
            <p>Votre profil et votre CV privé seront transmis au recruteur de cette offre.</p>
            <form id="quick-apply-form">
                <div class="form-group">
                    <label for="qa-msg">Message de motivation (facultatif)</label>
                    <textarea id="qa-msg" maxlength="3000"></textarea>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">Envoyer ma candidature</button>
            </form>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close-modal]').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', event => {
        if (event.target === modal) modal.remove();
    });
    modal.querySelector('#quick-apply-form').addEventListener('submit', event => handleQuickApply(event, jobId));
}

async function handleQuickApply(event, jobId) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const client = await window.requireSupabase();
        const { error } = await client.from('applications').insert({
            job_id: jobId,
            candidate_id: window.currentUser.id,
            cv_path: window.currentProfile.cv_path,
            message: document.getElementById('qa-msg').value.trim()
        });
        if (error) throw error;
        document.getElementById('apply-modal').remove();
        showToast('Votre candidature a été envoyée.');
    } catch (error) {
        console.error(error);
        showToast(error.code === '23505'
            ? 'Vous avez déjà postulé à cette offre.'
            : error.message || 'Impossible d’envoyer votre candidature.', 'error');
    } finally {
        button.disabled = false;
    }
}
