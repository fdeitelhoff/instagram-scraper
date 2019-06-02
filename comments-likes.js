const fs = require('fs');
const axios = require('axios');
const sleep = require('sleep');

const start = async function(purgeData) {
    const proxies = [];
    proxies.push({ host: '88.204.214.122', port: 8080 });
    proxies.push({ host: '59.153.100.84', port: 80 });

    console.log('Starting scraping comments and likes for posts...');

    if (purgeData) {
        console.log('Purging data due to command line argument...');

        fs.exists('./data/dataset_post_comments.csv', (exists) => {
            if (exists) {
                fs.unlinkSync('./data/dataset_post_comments.csv');
            }
        });

        fs.exists('./data/dataset_post_likes.csv', (exists) => {
            if (exists) {
                fs.unlinkSync('./data/dataset_post_likes.csv');
            }
        });  
        
        fs.exists('./data/processed_shortcodes.csv', (exists) => {
            if (exists) {
                fs.unlinkSync('./data/processed_shortcodes.csv');
            }
        }); 

        fs.appendFile('./data/dataset_post_comments.csv',
            `username;shortcode;commentCount;commentCountWithAnswers;comment_id;text;created_at;ownerId;ownerUsername\n`, (err) => {
                if (err) throw err;
            });

        fs.appendFile('./data/dataset_post_likes.csv',
            `username;shortcode;likedByCount;ownerId;username;full_name\n`, (err) => {
                if (err) throw err;
            });    

        fs.appendFile('./data/processed_shortcodes.csv',
            `shortcode\n`, (err) => {
                if (err) throw err;
            });  
    } 

    let processedShortcodes = [];
    
    if (fs.existsSync('./data/processed_shortcodes.csv')) {
        const data = fs.readFileSync('./data/processed_shortcodes.csv', 'utf8');
        processedShortcodes = data.trim().split('\n');
        processedShortcodes.shift();
    }

    // let i = 0;
    let rawdata = fs.readFileSync('./data/dataset_posts.json');
    let posts = JSON.parse(rawdata);

    console.log(`${posts.length} posts found...`);

    for (const post of posts) {      
        const postInfo = {
            shortcode: post['#debug'].shortcode,
            username: post['#debug'].userUsername, commentCount: 0, commentCountWithAnswers: 0, comments: [], likedByCount: 0, likedBy: []
        };

        if (processedShortcodes.includes(postInfo.shortcode)) {
            console.log(`Skipping already processed post ${postInfo.shortcode}...`);    
            continue;
        }

        console.log(`Getting comments and likes for post ${postInfo.shortcode}...`);

        // FD: Getting a random proxy.
        const commentProxy = proxies[randomIntFromInterval(0, proxies.length - 1)];
        await getComments(commentProxy, postInfo);

        // FD: Randomly waiting...
        sleep.sleep(randomIntFromInterval(1, 5));

        // FD: Getting a random proxy.
        const likeProxy = proxies[randomIntFromInterval(0, proxies.length - 1)];
        await getLikes(likeProxy, postInfo);

        saveData(postInfo);

        // if (i == 0) {
        //     break;
        // }

        // i++;
    }

    function saveData(postWithComments) {
        // FD: Saving all comments and likes in two csv files.
        console.log(`Saving data for post ${postWithComments.shortcode}...`);

        for (const comment of postWithComments.comments) {
            fs.appendFile('./data/dataset_post_comments.csv',
                `"${postWithComments.username}";"${postWithComments.shortcode}";${postWithComments.commentCount};${postWithComments.commentCountWithAnswers};${comment.id};"${comment.text}";${comment.created_at};${comment.ownerId};"${comment.ownerUsername}"\n`, (err) => {
                    if (err) throw err;
                });
        }

        for (const like of postWithComments.likedBy) {
            fs.appendFile('./data/dataset_post_likes.csv',
                `"${postWithComments.username}";"${postWithComments.shortcode}";${postWithComments.likedByCount};${like.id};"${like.username}";"${like.fullName}"\n`, (err) => {
                    if (err) throw err;
                });
        }

        fs.appendFile('./data/processed_shortcodes.csv',
            `${postWithComments.shortcode}\n`, (err) => {
                if (err) throw err;
            });   
    }

    async function getComments(proxy, postInfo, hasNextPage = false, endCursor = '') {
        // FD: Randomly waiting...
        sleep.sleep(randomIntFromInterval(1, 2));

        let url = '';
        if (!hasNextPage) {
            url = `https://www.instagram.com/graphql/query/?query_hash=97b41c52301f77ce508f55e66d17620e&variables={"shortcode":"${postInfo.shortcode}","first":24}`;
        } else {
            url = `https://www.instagram.com/graphql/query/?query_hash=97b41c52301f77ce508f55e66d17620e&variables={"shortcode":"${postInfo.shortcode}","first":24,"after":"${endCursor}"}`;
        }

        const response = await axios.get(url, {
            proxy: {
                host: proxy.host,
                port: proxy.port
            }
        });
        const data = response.data.data.shortcode_media.edge_media_to_parent_comment;
        postInfo.commentCountWithAnswers = data.count;
        postInfo.commentCount += data.edges.length;

        console.log(`Getting next ${data.edges.length} comments for post ${postInfo.shortcode}...`);

        for (const edge of data.edges) {
            const comment = { id: edge.node.id, text: edge.node.text, created_at: edge.node.created_at,
                ownerId: edge.node.owner.id, ownerUsername: edge.node.owner.username };
            postInfo.comments.push(comment);
        }        

        if (data.page_info.has_next_page) {
            await getComments(proxy, postInfo, data.page_info.has_next_page, data.page_info.end_cursor);
        }
    }

    async function getLikes(proxy, postInfo, hasNextPage = false, endCursor = '') {
        // FD: Randomly waiting...
        sleep.sleep(randomIntFromInterval(1, 2));

        let url = '';
        if (!hasNextPage) {
            url = `https://www.instagram.com/graphql/query/?query_hash=d5d763b1e2acf209d62d22d184488e57&variables={"shortcode":"${postInfo.shortcode}","first":24}`;
        } else {
            url = `https://www.instagram.com/graphql/query/?query_hash=d5d763b1e2acf209d62d22d184488e57&variables={"shortcode":"${postInfo.shortcode}","first":24,"after":"${endCursor}"}`;
        }

        const response = await axios.get(url, {
            proxy: {
                host: proxy.host,
                port: proxy.port
            }});
        const data = response.data.data.shortcode_media.edge_liked_by;
        postInfo.likedByCount += data.edges.length;

        console.log(`Getting next ${data.edges.length} likes for post ${postInfo.shortcode}...`);

        for (const edge of data.edges) {
            const like = {
                id: edge.node.id, username: edge.node.username, fullName: edge.node.full_name
            };
            postInfo.likedBy.push(like);
        }

        if (data.page_info.has_next_page) {
            await getLikes(proxy, postInfo, data.page_info.has_next_page, data.page_info.end_cursor);
        }
    }

    function randomIntFromInterval(min, max) { // min and max included
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
}

// FD: Will be messed up with other arguments...
const purgeData = process.argv[2] ? true : false;

start(purgeData);