document.addEventListener('DOMContentLoaded', async () => {
    const client = await window.backendReady;
    await window.authReady;
    initAccountForm(client);
    initCandidateForm(client);
    initRecruiterForm(client);
    initContactForm(client);
});

function formValue(id) {
    return document.getElementById(id).value.trim();
}

function splitFormList(value, separator, label) {
    const items = value.split(separator).map(item => item.trim()).filter(Boolean);
    if (items.length > 50) throw new Error(`${label} : 50 éléments maximum.`);
    return items;
}

function setFormBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = busy;
    button.dataset.originalText ||= button.textContent;
    button.textContent = busy ? 'Veuillez patienter…' : button.dataset.originalText;
}

function displayError(error, fallback) {
    console.error(error);
    showToast(error.message || fallback, 'error');
}

function initAccountForm(client) {
    const form = document.getElementById('account-form');
    if (!form) return;

    if (!client) {
        form.hidden = true;
        document.getElementById('account-panel').hidden = true;
        return;
    }

    const expectedRole = form.dataset.role;
    const accountMessage = document.getElementById('account-message');
    const signOutButton = document.getElementById('signout-button');
    const passwordResetButton = document.getElementById('password-reset-button');
    const passwordResetForm = document.getElementById('password-reset-form');
    let isRecoveryMode = new URLSearchParams(window.location.search).get('mode') === 'recovery';
    const profileForm = document.getElementById('candidate-profile-form') ||
        document.getElementById('recruiter-offer-form');
    const dashboard = document.getElementById('candidate-applications') ||
        document.getElementById('recruiter-dashboard');

    async function refreshAccount(session) {
        if (isRecoveryMode) {
            window.currentUser = session?.user || null;
            form.hidden = true;
            passwordResetButton.hidden = true;
            passwordResetForm.hidden = false;
            signOutButton.hidden = true;
            profileForm.hidden = true;
            dashboard.hidden = true;
            accountMessage.textContent = 'Choisissez un nouveau mot de passe pour votre compte.';
            return;
        }

        const user = session && session.user;
        if (!user) {
            window.currentUser = null;
            window.currentProfile = null;
            form.hidden = false;
            signOutButton.hidden = true;
            passwordResetButton.hidden = false;
            passwordResetForm.hidden = true;
            profileForm.hidden = true;
            dashboard.hidden = true;
            accountMessage.textContent = 'Connectez-vous ou créez un compte pour continuer.';
            return;
        }

        const { data: profile, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            displayError(error, 'Impossible de charger votre profil.');
            return;
        }
        if (profile.role !== expectedRole) {
            await client.auth.signOut();
            showToast('Ce compte ne correspond pas à cet espace.', 'error');
            return;
        }

        window.currentUser = user;
        window.currentProfile = profile;
        form.hidden = true;
        passwordResetButton.hidden = true;
        passwordResetForm.hidden = true;
        signOutButton.hidden = false;
        profileForm.hidden = false;
        dashboard.hidden = false;
        accountMessage.textContent = `Connecté : ${user.email}`;

        if (expectedRole === 'candidate') {
            populateCandidateProfile(profile);
            loadCandidateApplications(client, user.id);
        } else {
            loadRecruiterDashboard(client, user.id);
        }
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        setFormBusy(form, true);
        try {
            const email = formValue('account-email');
            const password = document.getElementById('account-password').value;
            const mode = document.getElementById('account-mode').value;
            const result = mode === 'signup'
                ? await client.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { role: expectedRole },
                        emailRedirectTo: new URL(window.location.pathname, window.location.origin).href
                    }
                })
                : await client.auth.signInWithPassword({ email, password });

            if (result.error) throw result.error;
            if (mode === 'signup' && !result.data.session) {
                accountMessage.textContent = 'Compte créé. Vérifiez votre boîte e-mail, confirmez votre adresse, puis connectez-vous.';
                showToast('Un e-mail de confirmation a été envoyé.', 'success');
                return;
            }
            await refreshAccount(result.data.session);
            const redirectPath = new URLSearchParams(window.location.search).get('redirect');
            if (mode === 'signin' && redirectPath) {
                const redirectUrl = new URL(redirectPath, window.location.origin);
                if (redirectUrl.origin === window.location.origin) window.location.assign(redirectUrl.href);
            }
        } catch (error) {
            displayError(error, 'La connexion a échoué.');
        } finally {
            setFormBusy(form, false);
        }
    });

    passwordResetButton.addEventListener('click', async () => {
        const email = formValue('account-email');
        if (!email) {
            document.getElementById('account-email').focus();
            showToast('Saisissez votre adresse e-mail pour recevoir le lien de réinitialisation.', 'error');
            return;
        }
        passwordResetButton.disabled = true;
        try {
            const redirectUrl = new URL(window.location.pathname, window.location.origin);
            redirectUrl.searchParams.set('mode', 'recovery');
            const { error } = await client.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl.href
            });
            if (error) throw error;
            accountMessage.textContent = 'Si un compte correspond à cette adresse, un e-mail de réinitialisation va être envoyé.';
            showToast('Vérifiez votre boîte e-mail pour réinitialiser votre mot de passe.', 'success');
        } catch (error) {
            displayError(error, 'Impossible d’envoyer le lien de réinitialisation.');
        } finally {
            passwordResetButton.disabled = false;
        }
    });

    passwordResetForm.addEventListener('submit', async event => {
        event.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        if (newPassword !== confirmPassword) {
            showToast('Les deux mots de passe ne correspondent pas.', 'error');
            return;
        }
        setFormBusy(passwordResetForm, true);
        try {
            const { error } = await client.auth.updateUser({ password: newPassword });
            if (error) throw error;
            isRecoveryMode = false;
            window.history.replaceState({}, '', window.location.pathname);
            const { data, error: sessionError } = await client.auth.getSession();
            if (sessionError) throw sessionError;
            await refreshAccount(data.session);
            showToast('Votre mot de passe a été mis à jour.', 'success');
        } catch (error) {
            displayError(error, 'Impossible de mettre à jour votre mot de passe.');
        } finally {
            setFormBusy(passwordResetForm, false);
        }
    });

    signOutButton.addEventListener('click', async () => {
        const { error } = await client.auth.signOut();
        if (error) {
            displayError(error, 'La déconnexion a échoué.');
            return;
        }
        await refreshAccount(null);
    });

    client.auth.getSession().then(({ data, error }) => {
        if (error) displayError(error, 'Impossible de vérifier la session.');
        else return refreshAccount(data.session);
    });
    client.auth.onAuthStateChange((_event, session) => {
        if (_event === 'PASSWORD_RECOVERY') {
            isRecoveryMode = true;
            refreshAccount(session);
            return;
        }
        refreshAccount(session);
    });
}

function populateCandidateProfile(profile) {
    document.getElementById('cand-email').value = profile.email;
    document.getElementById('cand-name').value = profile.full_name || '';
    document.getElementById('cand-phone').value = profile.phone || '';
    document.getElementById('cand-city').value = profile.city || '';
    document.getElementById('cand-job').value = profile.job_title || '';
    document.getElementById('cand-skills').value = (profile.skills || []).join(', ');
    document.getElementById('cand-education').value = profile.education || '';
    document.getElementById('cand-exp').value = profile.experience || '';
    document.getElementById('cand-bio').value = profile.bio || '';
    document.getElementById('candidate-cv-status').textContent = profile.cv_path
        ? 'Un CV est enregistré en privé. Vous pouvez en sélectionner un nouveau pour le remplacer.'
        : 'Aucun CV enregistré. Ajoutez votre CV pour postuler aux offres.';
}

function getCvFile(input) {
    const file = input.files && input.files[0];
    if (!file) return null;
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedExtension = /\.(pdf|docx)$/i.test(file.name);
    if (file.size > 5 * 1024 * 1024 || !allowedExtension || !allowedTypes.includes(file.type)) {
        throw new Error('Le CV doit être un fichier PDF ou DOCX valide de 5 Mo maximum.');
    }
    return file;
}

async function uploadCv(client, userId, file) {
    const safeExtension = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
    const path = `${userId}/${crypto.randomUUID()}.${safeExtension}`;
    const { error } = await client.storage
        .from('candidate-cvs')
        .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
}

function initCandidateForm(client) {
    const form = document.getElementById('candidate-profile-form');
    if (!form || !client) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!window.currentUser || !window.currentProfile) {
            showToast('Connectez-vous pour enregistrer votre profil.', 'error');
            return;
        }

        setFormBusy(form, true);
        try {
            const cvInput = document.getElementById('cand-cv');
            const file = getCvFile(cvInput);
            if (!file && !window.currentProfile.cv_path) {
                throw new Error('Ajoutez un CV PDF ou DOCX avant d’enregistrer votre profil.');
            }

            let cvPath = window.currentProfile.cv_path;
            if (file) cvPath = await uploadCv(client, window.currentUser.id, file);

            const profile = {
                email: window.currentUser.email,
                full_name: formValue('cand-name'),
                phone: formValue('cand-phone'),
                city: document.getElementById('cand-city').value,
                job_title: formValue('cand-job'),
                skills: splitFormList(formValue('cand-skills'), ',', 'Compétences'),
                education: document.getElementById('cand-education').value,
                experience: document.getElementById('cand-exp').value,
                bio: formValue('cand-bio'),
                cv_path: cvPath
            };
            const { data, error } = await client
                .from('profiles')
                .update(profile)
                .eq('id', window.currentUser.id)
                .select()
                .single();
            if (error) throw error;
            window.currentProfile = data;
            populateCandidateProfile(data);
            cvInput.value = '';
            showToast('Votre profil a été enregistré.', 'success');
        } catch (error) {
            displayError(error, 'Impossible d’enregistrer votre profil.');
        } finally {
            setFormBusy(form, false);
        }
    });
}

function initRecruiterForm(client) {
    const form = document.getElementById('recruiter-offer-form');
    if (!form || !client) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!window.currentUser || !window.currentProfile) {
            showToast('Connectez-vous avec votre compte recruteur pour publier une offre.', 'error');
            return;
        }

        setFormBusy(form, true);
        try {
            const offer = {
                recruiter_id: window.currentUser.id,
                company: formValue('rec-company'),
                title: formValue('rec-title'),
                category: document.getElementById('rec-category').value,
                contract: document.getElementById('rec-contract').value,
                city: document.getElementById('rec-city').value,
                quartier: formValue('rec-quartier'),
                salary: formValue('rec-salary') || 'À négocier',
                experience: document.getElementById('rec-exp').value || 'Non spécifié',
                education: formValue('rec-edu') || 'Non spécifié',
                description: formValue('rec-desc'),
                missions: splitFormList(formValue('rec-missions'), '\n', 'Missions'),
                skills: splitFormList(formValue('rec-skills'), ',', 'Compétences'),
                profile: formValue('rec-profile') || 'Profil motivé',
                contact_email: formValue('rec-email'),
                contact_phone: formValue('rec-phone')
            };
            const { error } = await client.from('jobs').insert(offer);
            if (error) throw error;
            form.reset();
            await loadRecruiterDashboard(client, window.currentUser.id);
            showToast('Votre offre est publiée et visible dans les offres d’emploi.', 'success');
        } catch (error) {
            displayError(error, 'Impossible de publier cette offre.');
        } finally {
            setFormBusy(form, false);
        }
    });
}

async function loadCandidateApplications(client, candidateId) {
    const container = document.getElementById('candidate-applications-list');
    if (!container) return;
    const { data, error } = await client
        .from('applications')
        .select('id,status,created_at,jobs(title,company,city)')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });
    if (error) {
        displayError(error, 'Impossible de charger vos candidatures.');
        return;
    }
    if (!data.length) {
        container.textContent = 'Vous n’avez pas encore envoyé de candidature.';
        return;
    }
    container.innerHTML = data.map(application => `
        <article class="job-card">
            <h3>${escapeHTML(application.jobs.title)}</h3>
            <p>${escapeHTML(application.jobs.company)} · ${escapeHTML(application.jobs.city)}</p>
            <p>Statut : <strong>${escapeHTML(applicationStatusLabel(application.status))}</strong> · ${new Date(application.created_at).toLocaleDateString('fr-FR')}</p>
        </article>
    `).join('');
}

async function loadRecruiterDashboard(client, recruiterId) {
    const container = document.getElementById('recruiter-dashboard-list');
    if (!container) return;
    container.textContent = 'Chargement des offres…';
    const { data, error } = await client
        .from('jobs')
        .select('id,title,company,city,status,created_at,applications(id,status,created_at,cv_path,candidate:profiles!applications_candidate_id_fkey(full_name,email,phone,job_title,skills,experience,education,bio))')
        .eq('recruiter_id', recruiterId)
        .order('created_at', { ascending: false });
    if (error) {
        displayError(error, 'Impossible de charger vos offres.');
        return;
    }
    if (!data.length) {
        container.textContent = 'Vous n’avez pas encore publié d’offre.';
        return;
    }

    container.innerHTML = data.map(job => `
        <article class="job-card" data-job-id="${escapeHTML(job.id)}">
            <h3>${escapeHTML(job.title)}</h3>
            <p>${escapeHTML(job.company)} · ${escapeHTML(job.city)} · ${escapeHTML(job.status === 'published' ? 'Publiée' : 'Fermée')}</p>
            <button type="button" class="btn btn-outline btn-sm" data-toggle-job="${escapeHTML(job.id)}" data-status="${escapeHTML(job.status)}">
                ${job.status === 'published' ? 'Fermer l’offre' : 'Republier l’offre'}
            </button>
            <h4 style="margin-top:1rem;">Candidatures (${job.applications.length})</h4>
            ${job.applications.length ? job.applications.map(application => `
                <div class="application-card" style="border-top:1px solid var(--border-color);padding:1rem 0;">
                    <strong>${escapeHTML(application.candidate.full_name)}</strong>
                    <p>${escapeHTML(application.candidate.email)} · ${escapeHTML(application.candidate.phone)}</p>
                    <p>${escapeHTML(application.candidate.job_title)} · ${escapeHTML(application.candidate.experience)}</p>
                    <p>Statut : ${escapeHTML(applicationStatusLabel(application.status))} · ${new Date(application.created_at).toLocaleDateString('fr-FR')}</p>
                    <button type="button" class="btn btn-outline btn-sm" data-cv-path="${escapeHTML(application.cv_path)}">Télécharger le CV</button>
                    <label>
                        Statut de la candidature
                        <select data-application-status="${escapeHTML(application.id)}">
                            ${['received', 'reviewing', 'accepted', 'rejected'].map(status =>
                                `<option value="${status}" ${application.status === status ? 'selected' : ''}>${applicationStatusLabel(status)}</option>`
                            ).join('')}
                        </select>
                    </label>
                </div>
            `).join('') : '<p>Aucune candidature pour le moment.</p>'}
        </article>
    `).join('');

    container.querySelectorAll('[data-toggle-job]').forEach(button => {
        button.addEventListener('click', async () => {
            const nextStatus = button.dataset.status === 'published' ? 'closed' : 'published';
            const { error: updateError } = await client
                .from('jobs')
                .update({ status: nextStatus })
                .eq('id', button.dataset.toggleJob)
                .eq('recruiter_id', recruiterId);
            if (updateError) displayError(updateError, 'Impossible de modifier le statut de l’offre.');
            else await loadRecruiterDashboard(client, recruiterId);
        });
    });

    container.querySelectorAll('[data-application-status]').forEach(select => {
        select.addEventListener('change', async () => {
            const { error: updateError } = await client
                .from('applications')
                .update({ status: select.value })
                .eq('id', select.dataset.applicationStatus);
            if (updateError) displayError(updateError, 'Impossible de modifier le statut de la candidature.');
            else showToast('Statut de candidature mis à jour.', 'success');
        });
    });

    container.querySelectorAll('[data-cv-path]').forEach(button => {
        button.addEventListener('click', async () => {
            const cvWindow = window.open('about:blank', '_blank');
            if (!cvWindow) {
                showToast('Autorisez les fenêtres contextuelles pour ouvrir le CV.', 'error');
                return;
            }
            cvWindow.opener = null;
            const { data: signed, error: signedError } = await client.storage
                .from('candidate-cvs')
                .createSignedUrl(button.dataset.cvPath, 60);
            if (signedError) {
                cvWindow.close();
                displayError(signedError, 'Impossible de générer le lien sécurisé du CV.');
                return;
            }
            cvWindow.location.href = signed.signedUrl;
        });
    });
}

function applicationStatusLabel(status) {
    return ({
        received: 'Reçue',
        reviewing: 'En cours d’examen',
        accepted: 'Acceptée',
        rejected: 'Refusée'
    })[status] || status;
}

function initContactForm(client) {
    const form = document.getElementById('contact-form');
    if (!form) return;
    if (!client) {
        form.hidden = true;
        form.closest('.form-container').hidden = true;
        return;
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        setFormBusy(form, true);
        try {
            const { error } = await client.from('contact_messages').insert({
                name: formValue('contact-name'),
                email: formValue('contact-email'),
                subject: formValue('contact-subject'),
                message: formValue('contact-message')
            });
            if (error) throw error;
            form.reset();
            showToast('Votre message a été enregistré.', 'success');
        } catch (error) {
            displayError(error, 'Impossible d’envoyer votre message.');
        } finally {
            setFormBusy(form, false);
        }
    });
}
