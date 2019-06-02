const fs = require('fs');
const axios = require('axios');

const start = async function() {
    console.log('Starting scraping comments and likes for posts...');

    let rawdata = fs.readFileSync('./data/dataset_posts.json');
    let posts = JSON.parse(rawdata);

    console.log(`${posts.length} posts found...`);

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

    const commentsPerPost = [];
    let i = 0;
    for (const post of posts) {      
        console.log(`Getting comments and likes for post ${post['#debug'].shortcode}...`);

        const postInfo = { shortcode: post['#debug'].shortcode,
            username: post['#debug'].userUsername, commentCount: 0, commentCountWithAnswers: 0, comments: [], likedByCount: 0, likedBy: [] };
        // await getComments(postInfo);
        await getLikes(postInfo);
        commentsPerPost.push(postInfo);

        if (i == 0) {
            break;
        }

        i++;
    }

    // FD: Saving all comments and likes in two csv files.
    fs.appendFile('./data/dataset_post_comments.csv',
    `username;shortcode;commentCount;commentCountWithAnswers;comment_id;text;created_at;ownerId;ownerUsername\n`, (err) => {
        if (err) throw err;
    });

    fs.appendFile('./data/dataset_post_likes.csv',
    `username;shortcode;likedByCount;ownerId;username;full_name\n`, (err) => {
        if (err) throw err;
    });

    for (const postWithComments of commentsPerPost) {
        console.log(`Saving data for post ${postWithComments.shortcode}...`);

        for (const comment of postWithComments.comments) {
            fs.appendFile('./data/dataset_post_comments.csv',
                `"${postWithComments.username}";"${postWithComments.shortcode}";${postWithComments.commentCount};${postWithComments.commentCountWithAnswers};${comment.id};"${comment.text}";${comment.created_at};${comment.ownerId};"${comment.ownerUsername}"\n`, (err) => {
                if (err) throw err;
                console.log(`Data for post ${postWithComments.shortcode} saved...`);
            });
        }      
        
        for (const like of postWithComments.likedBy) {
            fs.appendFile('./data/dataset_post_likes.csv',
                `"${postWithComments.username}";"${postWithComments.shortcode}";${postWithComments.likedByCount};${like.id};"${like.username}";"${like.fullName}"\n`, (err) => {
                if (err) throw err;
                console.log(`Data for post ${postWithComments.shortcode} saved...`);
            });
        }          
    }

    async function getComments(postInfo, hasNextPage = false, endCursor = '') {
        let url = '';
        if (!hasNextPage) {
            url = `https://www.instagram.com/graphql/query/?query_hash=97b41c52301f77ce508f55e66d17620e&variables={"shortcode":"${postInfo.shortcode}","first":12}`;
        } else {
            url = `https://www.instagram.com/graphql/query/?query_hash=97b41c52301f77ce508f55e66d17620e&variables={"shortcode":"${postInfo.shortcode}","first":12,"after":"${endCursor}"}`;
        }

        const response = await axios.get(url);
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
            await getComments(postInfo, data.page_info.has_next_page, data.page_info.end_cursor);
        }
    }

    async function getLikes(postInfo, hasNextPage = false, endCursor = '') {
        let url = '';
        if (!hasNextPage) {
            url = `https://www.instagram.com/graphql/query/?query_hash=d5d763b1e2acf209d62d22d184488e57&variables={"shortcode":"${postInfo.shortcode}","first":12}`;
        } else {
            url = `https://www.instagram.com/graphql/query/?query_hash=d5d763b1e2acf209d62d22d184488e57&variables={"shortcode":"${postInfo.shortcode}","first":12,"after":"${endCursor}"}`;
        }

        // let response = {};
        // try {
        const response = await axios.get(url);
        // } catch (error) {
        //     console.log('get likes axios error', error);
        // }
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
            await getLikes(postInfo, data.page_info.has_next_page, data.page_info.end_cursor);
        }
    }
}

start();