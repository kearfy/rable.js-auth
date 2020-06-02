const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

/**
 * Initial Library.
 *
 * @property {string} version The current version of the Library.
 * @property {object} config The configuration of the Library that was provided on initialization. Some variables were moved to private variables to make them unchangable.
 */

class RableAuth {
    #apiController;
    #rableInstance;
    #userTokenSecret;
    #callbacks;

    /**
     * Function that is called upon initialization.
     *
     * @param {object} input The input / configuration of the Library.
     * @param {object} input.callbacks [REQUIRED] Callbacks of the Library.
     * @param {function} input.callbacks.obtainUser [REQUIRED] Obtain the user based on their identifier. callback should return hashed password (bcrypt) and a systemIdentifier stored in a value identical to config option systemIdentifier. (identifier could be a username or email, not managed by the library. systemIdentifier could be a id, uuid or similar specific to the targeted user)
     * @param {function} input.callbacks.verifyPassword Alternative method of verifying the password. systemIdentifier will be provided through the first parameter, the plain password through the second one.
     * @param {function} input.callbacks.onLogin Fired when somebody successfully logs in. systemIdentifier will be provided through the first parameter.
     * @param {function} input.callbacks.onIncorrectPassword Fired when a user provides an incorrect password. The systemIdentifier will be provided through the first parameter.
     * @param {RableAPI} input.apiController [REQUIRED] rable.js-api instance. already configured with the rable.js instance.
     * @param {Rable} input.rableInstance [REQUIRED] rable.js instance.
     * @param {string} input.systemIdentifier [REQUIRED] systemIdentifier name for the users.
     *
     * @param {string} input.userTokenSecret random string which will be used to sign and verify the tokens. All previously made tokens will become invalid once changed. If none provided, the Library will generate a random secret.
     * @param {string} input.cookieName Name of the cookie where the token should be stored, if any. (not required, if no cookieName is defined, the token will be retured to the requestmaker)
     * @param {object} input.cookieOpts If a cookie will be set, the options for it. path will be set to '/' by default. refer to rable.js documentation for valid options.
     * @param {boolean} input.returnToken=false In case a cookieName was set, this will state if the token should be returned back to the user.
     * @param {string} input.api=auth Name of the API. (An existing API will not be overwritten, only the routes required for the extention to work)
     * @param {string} input.tokenExpiration=1h How long a token with expiration should last.
     * @param {string} input.allowNoExpiration=false States if a token without an expiration is allowed to be provided.
     * @param {boolean} input.autoRefresh=true In case the token is transported in a cookie, states if the cookie should automatically be updated with the new token. (req.newToken)
     */
    constructor(input) {
        this.version = require('./package.json').version;
        this.config = Object.assign(require('./default.json'), (input === undefined ? {} : input));
        this.config.cookieOpts = Object.assign(require('./default.json').cookieOpts, (input === undefined ? {} : input.cookieOpts));
        var requiredValues = [ 'callbacks', 'apiController', 'rableInstance', 'systemIdentifier'];
        Object.keys(this.config).forEach(key => {
            if (requiredValues.includes(key) && (this.config[key] === null || this.config[key] === false)) throw 'An error occured while initializing rable.js-auth: Required config key "' + key + '" was not provided!';
        });

        if (this.config.systemIdentifier.constructor.name != 'String') throw 'An error occured while initializing rable.js-auth: An invalid value was provided for config key systemIdentifier!';
        if (this.config.callbacks.obtainUser == null) throw 'An error occured while initializing rable.js-auth: The "obtainUser" callback is missing!';

        this.#callbacks = this.config.callbacks;
        this.#apiController = this.config.apiController;
        this.#rableInstance = this.config.rableInstance;
        this.#userTokenSecret = (this.config.userTokenSecret === null || this.config.userTokenSecret === false ? require('crypto').randomBytes(100).toString('hex') : this.config.userTokenSecret);
        delete this.config.callbacks;
        delete this.config.apiController;
        delete this.config.rableInstance;
        delete this.config.userTokenSecret;

        this.#rableInstance.use(() => {
            const authHeader = req.headers["'authorization'"] || req.headers['authorization'];
            var token = authHeader && authHeader.split(' ')[1];
            if (token != null && token.slice(-1) === "'") token = token.slice(0, -1);

            /**
             * @member Request
             * @inner
             * Keys added to the request.
             *
             * @property {boolean} authenticated States if the client is authenticated.
             * @property {null|string} user Null if client is not authenticated, else it will contain the systemIdentifier.
             * @property {null|string} newToken If a client is authenticated and the token has an expirary, then a new token will be generated. In the correct circumstances, a potential configured cookie will be updated with the new token.
             */
            const Request = {
                newToken: null,
                authenticated: false,
                user: null
            }

            Object.keys(Request).forEach(key => req[key] = Request[key]);

            if (token == null && this.config.cookieName != null && this.config.cookieName != false && req.cookies[this.config.cookieName] !== undefined) {
                token = req.cookies[this.config.cookieName];
            }

            if (token != null) try {
                const decoded = jwt.verify(token, this.#userTokenSecret);
                req.authenticated = true;
                req.user = decoded.systemIdentifier;
                if (decoded.exp != null) req.newToken = jwt.sign({systemIdentifier:req.user}, this.#userTokenSecret, {expiresIn: this.config.tokenExpiration});
                if (this.config.autoRefresh && req.newToken != null) res.setCookie(this.config.cookieName, req.newToken, this.config.cookieOpts);
            } catch(e) {}
        });

        this.authAPI = this.#apiController.obtainAPI(this.config.api);
        if (this.authAPI === null) this.authAPI = this.#apiController.createAPI(this.config.api);
        this.authAPI.registerAction('login', async (req, res) => {
            if (req.body.identifier !== undefined && req.body.password !== undefined) {
                const user = await this.#callbacks.obtainUser(req.body.identifier);
                if (user == null) {
                    res.json({
                        success: false,
                        error: 'unknown_user',
                        message: 'A user with the provided identifier could not be found.'
                    });
                } else {
                    if (user[this.config.systemIdentifier] === undefined || user.password === undefined) {
                        res.json({
                            success: false,
                            error: 'server_error',
                            message: 'A callback did not provide required data.'
                        }, {status:500})
                    } else {
                        var passwordVerificationCallback = (err, correctPassword) => {
                            if (err) return res.json({
                                success: false,
                                error: 'server_error',
                                message: 'An error occured while verifying the password.'
                            }, {status:500})

                            if (correctPassword) {
                                try {
                                    var payload = {systemIdentifier: user[this.config.systemIdentifier]};
                                    var expire = (this.config.allowNoExpiration === false || req.body.noExpiration !== true);
                                    const token = jwt.sign(payload, this.#userTokenSecret, (expire ? {expiresIn: this.config.tokenExpiration} : {}));
                                    if (this.#callbacks.onLogin !== undefined) this.#callbacks.onLogin(user[this.config.systemIdentifier])

                                    if (this.config.cookieName == null || !this.config.cookieName) {
                                        res.json({
                                            success: true,
                                            token: token
                                        });
                                    } else {
                                        res.setCookie(this.config.cookieName, token, this.config.cookieOpts);
                                        if (this.config.returnToken === false) {
                                            res.json({
                                                success: true
                                            });
                                        } else {
                                            res.json({
                                                success: true,
                                                token: token
                                            });
                                        }
                                    }
                                } catch(e) {
                                    res.json({
                                        success: false,
                                        error: 'server_error',
                                        message: 'An unexpected error occured while generating the token.'
                                    });
                                }
                            } else {
                                if (this.#callbacks.onIncorrectPassword !== undefined) this.#callbacks.onIncorrectPassword(user[this.config.systemIdentifier]);
                                res.json({
                                    success: false,
                                    error: 'incorrect_password',
                                    message: 'An incorrect password was provided for the matched user.'
                                });
                            }
                        }

                        if (this.#callbacks.verifyPassword !== undefined) {
                            this.#callbacks.verifyPassword(user[this.config.systemIdentifier], req.body.password, passwordVerificationCallback);
                        } else {
                            bcrypt.compare(req.body.password, user.password, passwordVerificationCallback);
                        }
                    }
                }
            } else {
                res.json({
                    success: false,
                    error: 'missing_keys',
                    message: 'Either the identifier, the password or both were not provided.'
                });
            }
        });

        this.authAPI.registerAction('authenticated', (req, res) => {
            res.json({
                success: true,
                authenticated: req.authenticated
            });
        }, 'get');
    }

    /**
     * Hash the password (uses bcrypt.hashSync with 10 rounds).
     *
     * @param {string} password The password.
     * @returns {string} The hashed password.
     */

    hashPassword(password) {
        return bcrypt.hashSync(password, 10);
    }
}

module.exports = RableAuth;
