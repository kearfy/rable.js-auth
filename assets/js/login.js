document.querySelector('.links .back').addEventListener('click', e => {
    e.preventDefault();
    history.back();
});

document.querySelector('.links .continue').addEventListener('click', e => {
    e.preventDefault();
    document.querySelector('form.box').dispatchEvent(new CustomEvent('submit'));
});

document.querySelectorAll('form.box input').forEach(el => el.addEventListener('keydown', e => {
    if (e.keyCode == 13) document.querySelector('form.box').dispatchEvent(new CustomEvent('submit'));
}))

document.querySelector('form.box').addEventListener('submit', e => {
    e.preventDefault();

    e.target.identifier.classList.remove('wrong');
    e.target.password.classList.remove('wrong');

    if (e.target.identifier.value != null && e.target.password.value != null && e.target.identifier.value != '' && e.target.password.value != '') {
        fetch('api/auth/login', {
            method: "POST",
            body: new URLSearchParams(new FormData(e.target))
        }).then(res => res.json()).then(res => {
            if (res.success) {
                updateAuthenticationState();
                ClientRouter.navigate('myaccount', 'myaccount');
            } else {
                if (res.error == 'unknown_user') {
                    e.target.identifier.classList.add('wrong');
                } else if (res.error == 'incorrect_password') {
                    e.target.password.classList.add('wrong');
                } else {
                    new Notification({
                        type: 'error',
                        content: (res.message == undefined ? res.error : res.error + ': ' + res.message)
                    }).deploy();
                }
            }
        })
    } else {
        if (e.target.identifier.value == null || e.target.identifier.value == '') e.target.identifier.classList.add('wrong');
        if (e.target.password.value == null || e.target.password.value == '') e.target.password.classList.add('wrong');
    }
});

document.querySelector('input[name=identifier]').focus();
