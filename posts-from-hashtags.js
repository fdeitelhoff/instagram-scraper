const axios = require("axios");
const sleep = require("sleep");
const moment = require("moment");
var HTMLParser = require("node-html-parser");
var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database("./data/db.instagram");

let i = 1;

const start = async function () {
    const hashtags = ["sokofuture"]; // "ac2106"

    for (const hashtag of hashtags) {
        console.log(`Getting data for hashtag ${hashtag}...`);
        
        await getHashtagData(hashtag);
    }    

    async function getHashtagData(hashtag = '', hasNextPage = false, endCursor = "") {
        try {
            let postsUrl = "";
            if (!hasNextPage) {
                postsUrl = `https://www.instagram.com/graphql/query/?query_hash=f92f56d47dc7a55b606908374b43a314&variables={"tag_name":"${hashtag}","first":50}`;
            } else {
                postsUrl = `https://www.instagram.com/graphql/query/?query_hash=f92f56d47dc7a55b606908374b43a314&variables={"tag_name":"${hashtag}","first":50,"after":"${endCursor}"}`;
            }

            const response = await axios.get(postsUrl);
            const edges = response.data.data.hashtag.edge_hashtag_to_media.edges;
            const pageInfo = response.data.data.hashtag.edge_hashtag_to_media.page_info;
            
            for (const post of edges) {
                if (i % 200 === 0) {
                    const sleeping = 310;
                    sleep.sleep(sleeping);
                    console.log(`Sleeping for ${sleeping} seconds...`);
                    i = 0;
                }

                const node = post.node;

                console.log(`${i}. Getting data for post ${node.shortcode} for hashtag ${hashtag}...`);

                const caption = node.edge_media_to_caption; // FD: New approach for the "first comment".

                // FD: We use 'username' and 'full_name'.
                const userData = await getUserData(node.owner.id);
                if (!userData.username) {
                    console.log(userData);
                    return;
                }

                const postInfo = {
                    shortcode: node.shortcode,
                    userid: node.owner.id,
                    username: userData.username,
                    userFullName: userData.full_name,
                    url: `https://www.instagram.com/p/${node.shortcode}`,
                    caption: caption.edges[0] !== undefined ? caption.edges[0].node.text : '',
                    imageUrl: node.thumbnail_src,
                    likesCount: node.edge_media_preview_like.count,
                    timestamp: node.taken_at_timestamp
                };

                var dateTime = moment(postInfo.timestamp);

                db.get(
                    `SELECT Count(1) as PostExists FROM Posts WHERE Shortcode = "${postInfo.shortcode}"`,
                    async (err, results) => {
                        if (err) {
                            console.log(err);
                        } else {
                            if (results.PostExists) {
                                await updatePost(hashtag, postInfo.shortcode);
                            } else {
                                await createNewPost(hashtag, postInfo, dateTime);
                            }
                        }
                    }
                );

                i++;
            }

            if (pageInfo.has_next_page) {
                await getHashtagData(hashtag, true, pageInfo.end_cursor);
            }
        } catch (error) {
            console.log(error);
        }
    };

    async function updatePost(hashtag, shortcode) {
        console.log(`Updating post for shortcode ${shortcode} with hashtag ${hashtag}...`);

        db.run(
            `UPDATE Posts SET HashtagSearch = "${hashtag}" WHERE Shortcode = "${shortcode}"`
        );
    }

    async function createNewPost(hashtag, postInfo, dateTime) {
        console.log(`Saving new post for shortcode ${postInfo.shortcode}...`);

        db.run(
            "INSERT INTO Posts (ShortCode, UserId, Username, UserFullName, Url, ImageUrl, Caption, LikesCount, Created, CreatedDate, CreatedTime, HashtagSearch, Complete, Error, Chunk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
                dateTime.format("YYYY-MM-DD"),
                dateTime.format("HH:mm:ss"),
                hashtag,
                0,
                null,
                "J3"
            ]
        );        
    }

    async function getUserData(userId = -1) {
        let userData = {};

        try {
            const checkUserUrl = `https://www.instagram.com/graphql/query/?query_hash=aec5501414615eca36a9acf075655b1e&variables={"user_id":"${userId}","include_chaining":true,"include_reel":true,"include_suggested_users":false,"include_logged_out_extras":false,"include_highlight_reels":false}`;
            const checkUserResponse = await axios.get(checkUserUrl, {
                //   proxy: {
                //     host: proxy.host,
                //     port: proxy.port,
                //     auth: {
                //       username: proxy.user,
                //       password: proxy.password
                //     }
                //   }
            });

            const userDataCheck = checkUserResponse.data.data.user.reel.user;

            const url = `https://www.instagram.com/${userDataCheck.username}`;
            const response = await axios.get(url, {
                //   proxy: {
                //     host: proxy.host,
                //     port: proxy.port,
                //     auth: {
                //       username: proxy.user,
                //       password: proxy.password
                //     }
                //   }
            });

            const root = HTMLParser.parse(response.data, {
                lowerCaseTagName: false, // convert tag name to lower case (hurt performance heavily)
                script: true, // retrieve content in <script> (hurt performance slightly)
                style: false, // retrieve content in <style> (hurt performance slightly)
                pre: false // retrieve content in <pre> (hurt performance slightly)
            });

            let scriptData = "";
            const scriptTags = root.querySelectorAll("script");
            for (const scriptTag of scriptTags) {
                if (
                    typeof scriptTag.rawText.indexOf === "function" &&
                    scriptTag.rawText.indexOf("window._sharedData = ") === 0
                ) {
                    scriptData = scriptTag.rawText.replace(/;/g, "");
                    scriptData = scriptData.replace(/window._sharedData =/g, "");
                }
            }

            const data = JSON.parse(scriptData);
            userData = data.entry_data.ProfilePage[0].graphql.user;
            userData.username = userDataCheck.username; // FD: Overwriting the "UsernameChange" with the data from the previous check. The usernames can differ!
            userData.Error = null;
        } catch (error) {
            userData.username = 'Not available';
            userData.full_name = 'Not available';
        }

        return userData;
    }
};

start();