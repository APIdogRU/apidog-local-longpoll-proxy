const http = require('http');
const https = require('https');
const package = require('./package.json');

/*****************
 * Configuration *
 *****************/

/**
 * Порт, используемый для локального прокси-longpoll-сервера.
 * По умолчанию веб-версия APIdog проверяет 4006 порт.
 */
const PORT = 4006;

/**
 * User-agent для запросов к ВКонтакте.
 * <s>Можно не менять, от него ничего не зависит</s>.
 * Зависит - если UA от официального приложения - будет
 * меньше ограничений (например, будут отдаваться прямые
 * ссылки на видеозаписи).
 */
const USER_AGENT = 'VKAndroidApp/7.7-10445 (Android 10; SDK 29; arm64-v8a; Xiaomi Mi A1; en; 1920x1080)';


/***********************************
 *                                 *
 *     DO NOT TOUCH CODE BELOW     *
 *                                 *
 ***********************************/

// Заголовки для CORS: разрешаем apidog.ru получить ответ
const corsHeaders = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'POST, GET',
};

/**
 * Отправка ответа
 * @param {http.ServerResponse} response
 * @param {String} body
 */
function sendResponseBase(response, body) {
	response.writeHead(200, {
		'content-type': 'application/json; charset=utf-8',
		...corsHeaders,
	});
	response.write(body);
	response.end();
}

/**
 *
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 * @param {String} hostname
 * @param {String} path
 */
function proxy(request, response, hostname, path) {
	const headers = request.headers;

	const options = {
		hostname,
		path,
		method: request.method,
		headers: {
			'user-agent': USER_AGENT,
			'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'accept-language': 'en-US,en;q=0.5',
			'connection': 'keep-alive',
			'referer': 'https://vk.com/',
			'origin': 'https://vk.com',
			'cookie': '',
		},
		rejectUnauthorized: false,
	};

	if (headers['content-type']) {
		options.headers['content-type'] = headers['content-type'];
	}

	const proxyRequest = https.request(options, proxyResponse => {
		response.writeHead(proxyResponse.statusCode, {
			...proxyResponse.headers,
			...corsHeaders,
		});
		proxyResponse.pipe(response, { end: true });
	});

	request.pipe(proxyRequest, { end: true });
};


let countRequests = 0;

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
function onRequest(request, response) {
	const host = request.headers.host;
	const url = new URL(`http://${host}${request.url}`);
	const path = url.pathname;
	const query = url.searchParams;

	const sendResponse = sendResponseBase.bind(null, response);

	countRequests++;

	switch (path) {
		case '/ack': {
			sendResponse(JSON.stringify({ status: true, version: package.apidog_llpp_version }));
			return;
		}

		case '/favicon.ico': {
			sendResponse('.');
			return;
		}

		case '/longpoll': {
			if (!query.has('server')) {
				sendResponse('wtf');
				return;
			}

			const [host, path] = query.get('server').split('/');

			const queryString = new URLSearchParams({
				act: 'a_check',
				wait: 25,
				mode: query.has('mode') ? query.get('mode') : (2 | 8 | 64 | 128),
				key: query.get('key'),
				ts: query.get('ts'),
				version: query.has('version') ? query.get('version') : '1',
			});

			proxy(request, response, host, `/${path}?${queryString.toString()}`);
			return;
		}

		case '/video': {
			if (!query.has('url')) {
				sendResponse('wtf');
				return;
			}

			const { host, pathname, search } = new URL(query.get('url'));

			proxy(request, response, host, pathname + search);
			return;
		}

		default: {
			proxy(request, response, 'api.vk.com', request.url);
		}
	}
};

function checkForUpdate() {
	https.get('https://raw.githubusercontent.com/APIdogRU/apidog-local-longpoll-proxy/master/package.json', res => {
		let content = '';
		res.on('data', chunk => content += chunk);
		res.on('end', () => {
			const json = JSON.parse(content);

			if (json.apidog_llpp_version > package.apidog_llpp_version) {
				console.warn(`########################################################################
###           There is a new version. In order to update,            ###
###        follow the link below and download the new version.       ###
### https://github.com/APIdogRU/apidog-local-longpoll-proxy/releases ###
########################################################################`);
			}

		});
	});
};



checkForUpdate();

console.log(`APIdog Local LongPoll Proxy (version ${package.version})`);
console.log('Starting LLPP...');
http.createServer(onRequest).listen(PORT);
console.log(`LLPP successfully started on port ${PORT}...`);

//const symbols = [' ', '░', '▒', '▓', '█', '▓', '▒', '░'];
const symbols = ['|', '/', '-', '\\'];
let s = 0;

setInterval(() => {
	process.stdout.write(`\r${symbols[s % symbols.length]} working... ${countRequests} requests handled`);
	s++;
}, 1000);
