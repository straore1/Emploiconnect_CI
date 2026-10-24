(() => {
    const config = window.EMPLOICONNECT_CONFIG || {};

    function showBackendNotice(message) {
        const notice = document.createElement('div');
        notice.setAttribute('role', 'alert');
        notice.style.cssText = 'position:sticky;top:0;z-index:10001;padding:0.85rem 1rem;background:#fff3cd;color:#664d03;text-align:center;border-bottom:1px solid #ffecb5;';
        notice.textContent = message;
        document.body.prepend(notice);
    }

    window.supabaseClient = null;
    window.backendReady = Promise.resolve().then(() => {
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            showBackendNotice('Configuration Supabase manquante : renseignez js/config.js pour activer les données et les comptes.');
            return null;
        }

        let projectUrl;
        try {
            projectUrl = new URL(config.supabaseUrl);
        } catch (error) {
            console.error('URL Supabase invalide.', error);
            showBackendNotice('URL Supabase invalide : vérifiez js/config.js.');
            return null;
        }
        if (projectUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(projectUrl.hostname)) {
            showBackendNotice('L’URL Supabase doit utiliser HTTPS.');
            return null;
        }

        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            showBackendNotice('Le service Supabase est indisponible. Vérifiez votre connexion Internet et rechargez la page.');
            return null;
        }

        try {
            window.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            return window.supabaseClient;
        } catch (error) {
            console.error('Impossible d’initialiser Supabase.', error);
            showBackendNotice('Impossible d’initialiser Supabase. Vérifiez les valeurs de js/config.js.');
            return null;
        }
    });

    window.currentUser = null;
    window.currentProfile = null;
    window.authReady = window.backendReady.then(async client => {
        if (!client) return null;
        const { data, error } = await client.auth.getSession();
        if (error) {
            console.error('Impossible de vérifier la session Supabase.', error);
            return null;
        }
        window.currentUser = data.session?.user || null;
        if (!window.currentUser) return null;

        const { data: profile, error: profileError } = await client
            .from('profiles')
            .select('*')
            .eq('id', window.currentUser.id)
            .maybeSingle();
        if (profileError) {
            console.error('Impossible de charger le profil Supabase.', profileError);
            return null;
        }
        window.currentProfile = profile;
        return profile;
    });

    window.backendReady.then(client => {
        if (!client) return;
        client.auth.onAuthStateChange((_event, session) => {
            window.currentUser = session?.user || null;
            if (!window.currentUser) {
                window.currentProfile = null;
                return;
            }
            Promise.resolve().then(async () => {
                const { data, error } = await client
                    .from('profiles')
                    .select('*')
                    .eq('id', window.currentUser.id)
                    .maybeSingle();
                if (error) console.error('Impossible de charger le profil Supabase.', error);
                else window.currentProfile = data;
            });
        });
    });

    window.requireSupabase = async () => {
        const client = await window.backendReady;
        if (!client) {
            throw new Error('Supabase n’est pas configuré. Consultez README.md pour terminer la configuration.');
        }
        return client;
    };
})();
