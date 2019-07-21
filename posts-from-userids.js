const axios = require("axios");
// const sleep = require("sleep");
// const moment = require("moment");
var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database("./data/db.instagram");

const start = async function () {
        // "10403237330"
    const userIds = [ "14773754174", "265400016", "1487897728", "14697384922" ];

    for (const userId of userIds) {
        console.log(`Getting data for user id ${userId}...`);

        await getPostData(userId);
    }    

    async function getPostData(userId = -1, hasNextPage = false, endCursor = "") {
        let postsUrl = "";
        if (!hasNextPage) {
            postsUrl = `https://www.instagram.com/graphql/query/?query_hash=f2405b236d85e8296cf30347c9f08c2a&variables={"id":"${userId}","first":50}`;
        } else {
            postsUrl = `https://www.instagram.com/graphql/query/?query_hash=f2405b236d85e8296cf30347c9f08c2a&variables={"id":"${userId}","first":50,"after":"${endCursor}"}`;
        }

        const response = await axios.get(postsUrl);
        const edges = response.data.data.user.edge_owner_to_timeline_media.edges;
        const pageInfo = response.data.data.user.edge_owner_to_timeline_media.page_info;

        for (const post of edges) {
            const node = post.node;

            console.log(`Getting data for post ${node.shortcode} for user id ${userId}...`);

            const caption = node.edge_media_to_caption; // FD: New approach for the "first comment".

            const postInfo = {
                shortcode: node.shortcode,
                userid: node.owner.id,
                username: node.owner.username,
                userFullName: "to be filled",  // FD: Seems I cannot get the data via the above graphq query.
                url: `https://www.instagram.com/p/${node.shortcode}`,
                caption: caption.edges[0].node.text,
                imageUrl: node.thumbnail_src,
                likesCount: node.edge_media_preview_like.count,
                timestamp: node.taken_at_timestamp
            };

            db.run(
                "INSERT INTO Posts (ShortCode, UserId, Username, UserFullName, Url, ImageUrl, Caption, LikesCount, Timestamp, Complete, Error, Chunk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    postInfo.shortcode,
                    postInfo.userid,
                    postInfo.username,
                    postInfo.userFullName,
                    postInfo.url,
                    postInfo.imageUrl,
                    postInfo.caption,
                    postInfo.likesCount,
                    postInfo.timestamp,
                    0,
                    null,
                    "J"
                ]
            );
        }

        if (pageInfo.has_next_page) {
            await getPostData(userId, true, pageInfo.end_cursor);
        }
    };
};

start();