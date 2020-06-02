module.exports = dataStore => {
    var callbacks = {
        obtainUser: (identifier, bySystemIdentifier = false) => dataStore.db.userStore.find(user => (bySystemIdentifier ? user.uuid === identifier : (user.username === identifier || user.email == identifier))),
        onLogin: systemIdentifier => {
            var u = callbacks.obtainUser(systemIdentifier, true);
            console.log('User ' + u.firstname + ' ' + u.lastname + ' has signed in.');
        },
        onIncorrectPassword: systemIdentifier => {
            var u = callbacks.obtainUser(systemIdentifier, true);
            console.log('In an attempt to sign user ' + u.firstname + ' ' + u.lastname + ' in an incorrect password was provided!');
        }
    }

    return callbacks;
};
