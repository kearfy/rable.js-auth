const Rable = require('rable.js');
const RableAPI = require('rable.js-api');
const RableAuth = require(__dirname + '/lib');
const LocDB = require('locdb');
const dataStore = new LocDB(__dirname + '/dataStore');
const callbacks = require(__dirname + '/callbacks.js')(dataStore);
const app = new Rable({
	port: 3003,
	assets: 'assets'
});

const api = new RableAPI(app);
const auth = new RableAuth({

	//Required values
	apiController: api,
	rableInstance: app,
	systemIdentifier: 'uuid',
	callbacks: callbacks,

	//Token secrets
	userTokenSecret: 'ExampleSecret', //THIS SHOULD BE CHANGED!
	allowNoExpiration: false,
	cookieName: 'user_token'
});

app.info.set('name', 'rable.js-auth ' + auth.version + ' showcase');
app.info.set('version', auth.version);

app.template.setElement('head', __dirname + '/elements/head.rbl');
app.template.setElement('navbar', __dirname + '/elements/navbar.rbl');
app.template.setElement('footer', __dirname + '/elements/footer.rbl');

app.get('/', __dirname + '/views/home.html');
app.static('/docs', __dirname + '/docs/rable.js-auth', {noTemplate: true});

app.get('/login', (req, res) => {
	if (req.authenticated) {
		res.redirect('myaccount');
	} else {
		res.sendFile(__dirname + '/views/login.html');
	}
});

app.get('/myaccount', (req, res) => {
	if (req.authenticated) {
		var user = callbacks.obtainUser(req.user, true);
		if (user !== undefined) {
			res.sendFile(__dirname + '/views/myaccount.rbl', {data:{user: user}});
		} else {
			res.sendError(500, {
				error: 'unknown_user',
				errorMessage: 'The currently signed-in user was not found in our database! Please try to logout and then log back in.'
			});
		}
	} else {
		res.redirect('login');
	}
});
