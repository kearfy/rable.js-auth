window.signout = (e) => {
    try {
        e.preventDefault();
    } catch (e) {}

    document.cookie = 'user_token=; Max-Age=-99999999;';
    document.querySelectorAll('[visitor]').forEach(el => el.style.display = null);
    document.querySelectorAll('[authenticated]').forEach(el => el.style.display = 'none');
    ClientRouter.navigate('/', '/');
}

window.updateAuthenticationState = () => {
    if (localStorage.getItem('user_token') != null) {
        fetch('api/auth/authenticated').then(res => res.json()).then(res => {
            if (res.success && res.authenticated) {
                document.querySelectorAll('[visitor]').forEach(el => el.style.display = 'none');
                document.querySelectorAll('[authenticated]').forEach(el => el.style.display = null);
            } else {
                document.querySelectorAll('[visitor]').forEach(el => el.style.display = null);
                document.querySelectorAll('[authenticated]').forEach(el => el.style.display = 'none');
            }
        });
    } else {
        document.querySelectorAll('[visitor]').forEach(el => el.style.display = null);
        document.querySelectorAll('[authenticated]').forEach(el => el.style.display = 'none');
    }
}

window.addEventListener('load', e => {
    document.querySelectorAll('[authenticated]').forEach(el => el.style.display = 'none');
    updateAuthenticationState();
});

window.addEventListener('AjaxNavigated', updateAuthenticationState);
