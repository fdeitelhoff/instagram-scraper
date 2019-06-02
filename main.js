const Apify = require('apify');
const main = require('./src/index');
// const fs = require('fs');

Apify.main(main);

// Apify.main(async () => {
//     await main('details');

//     let rawdata = fs.readFileSync('./apify_storage/datasets/instagram-posts/000000001.json');
//     let post = JSON.parse(rawdata);
//     console.log('post', post);  

//     // await main('posts');
// });
