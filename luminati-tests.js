const axios = require("axios");

// 'http://lum-customer-hl_48bba5e5-zone-ucsm_instagram:icgcfgsku3fp@zproxy.lum-superproxy.io:22225'

// let httpsProxyAgent = require('https-proxy-agent');
// var agent = new httpsProxyAgent('http://lum-customer-hl_48bba5e5-zone-ucsm_instagram:icgcfgsku3fp@zproxy.lum-superproxy.io:22225');
// var testApi = 'https://www.instagram.com';

// var config = {
//     baseUrl: testApi,
//     url: '/',
//     httpsAgent: agent
// }

// axios.request(config).then((res) => console.log(res)).catch(err => console.log(err))


var request = require('request-promise');
var username = 'lum-customer-hl_48bba5e5-zone-ucsm_instagram-route_err-pass_dyn';
var password = 'icgcfgsku3fp';
var port = 22225;
var session_id = (1000000 * Math.random()) | 0;
var super_proxy = 'http://' + username + '-session-' + session_id + ':' + password + '@zproxy.lum-superproxy.io:' + port;
var options = {
    url: 'https://www.instagram.com',
    proxy: super_proxy,
};
console.log('Performing request');
request(options)
    .then(function (data) { console.log(data); }, function (err) { console.error(err); });