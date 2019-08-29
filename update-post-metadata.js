const axios = require("axios");
const sleep = require("sleep");
const moment = require("moment");
var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database("./data/db.instagram");

// db.on("profile", sql => {
//   console.log(`Database trace: ${sql}`);
// });

const start = async function() {
  console.log("Update metadata posts (existing and new ones)...");

  let userIds = [];
  let resume = {};
  db.get(
    "SELECT Shortcode, Type, EndCursor FROM Resume WHERE Type = 'Metadata' ORDER BY Timestamp DESC LIMIT 1;",
    async (err, results) => {
      if (err) {
        console.log(err);
      } else {
        resume = results;

        if (resume) {
          await startResumeData();
        } else {
          db.all(
            "SELECT DISTINCT UserId FROM Posts WHERE MetadataUpdate = 0 AND HashtagSearch = 'sokofuture' AND Error IS NULL;",
            async (err, results) => {
              if (err) {
                console.log(err);
              } else {
                // console.log(results);
                userIds = results;

                await getMetadata();
              }
            }
          );
        }
      }
    }
  );

  async function startResumeData() {
    console.log(
      `Resuming userid ${resume.Shortcode} for Type ${resume.Type} with End Cursor ${resume.EndCursor}`
    );

    if (resume.Type === "Metadata") {
      await getPostData(resume.Shortcode);
    }

    console.log(`Updating status for post ${resume.Shortcode}...`);
    db.run(
      `UPDATE Posts SET MetadataUpdate = 1 WHERE Shortcode = "${resume.Shortcode}"`
    );

    console.log(
      `Resuming done... deleting resume info and start scraping again...`
    );

    db.all(
      "SELECT DISTINCT UserId FROM Posts WHERE MetadataUpdate = 0 AND HashtagSearch = 'sokofuture' AND Error IS NULL;",
      async (err, results) => {
        if (err) {
          console.log(err);
        } else {
          // console.log(results);
          userIds = results;

          await deleteResumeData(
            resume.Shortcode,
            resume.Type,
            resume.EndCursor
          );
          resume = undefined; // FD: For the safety... accessing should result in an error.

          await getMetadata();
        }
      }
    );
  }

  async function createResumeData(shortcode, type, endCursor) {
    db.run("INSERT INTO Resume (Shortcode, Type, EndCursor) VALUES (?, ?, ?)", [
      shortcode,
      type,
      endCursor
    ]);
  }

  async function deleteResumeData(shortcode, type, endCursor) {
    db.run(
      `DELETE FROM Resume WHERE Shortcode = "${shortcode}" AND Type = "${type}" AND EndCursor = "${endCursor}"`
    );
  }

  async function getMetadata() {
    console.log(`Found ${userIds.length} user ids...`);

    for (const userId of userIds) {
      console.log(`Getting data for user id ${userId.UserId}...`);

      await getPostData(userId.UserId);
    }
  }

  async function getPostData(userId = -1, hasNextPage = false, endCursor = "") {
    let postsUrl = "";
    if (!hasNextPage) {
      postsUrl = `https://www.instagram.com/graphql/query/?query_hash=f2405b236d85e8296cf30347c9f08c2a&variables={"id":"${userId}","first":50}`;
    } else {
      postsUrl = `https://www.instagram.com/graphql/query/?query_hash=f2405b236d85e8296cf30347c9f08c2a&variables={"id":"${userId}","first":50,"after":"${endCursor}"}`;
    }

    try {
      await createResumeData(userId, "Metadata", endCursor);

      const response = await axios.get(postsUrl);
      const edges = response.data.data.user.edge_owner_to_timeline_media.edges;
      const pageInfo =
        response.data.data.user.edge_owner_to_timeline_media.page_info;

      for (const post of edges) {
        const node = post.node;

        console.log(
          `Getting data for post ${node.shortcode} for user id ${userId}...`
        );

        const caption = node.edge_media_to_caption; // FD: New approach for the "first comment".

        const postInfo = {
          shortcode: node.shortcode,
          userid: node.owner.id,
          username: node.owner.username,
          userFullName: "to be filled", // FD: Seems I cannot get the data via the above graphq query.
          url: `https://www.instagram.com/p/${node.shortcode}`,
          caption:
            caption.edges[0] !== undefined ? caption.edges[0].node.text : "",
          imageUrl: node.thumbnail_src,
          likesCount: node.edge_media_preview_like.count,
          timestamp: node.taken_at_timestamp,
          isVideo: node.is_video,
          videoViewCount: node.video_view_count ? node.video_view_count : 0,
          videoUrl: node.video_url ? node.video_url : "",
          trackingToken: node.tracking_token,
          takenAt: node.taken_at_timestamp
        };

        var dateTime = moment(postInfo.timestamp);

        db.get(
          `SELECT Count(1) as PostExists FROM Posts WHERE Shortcode = '${postInfo.shortcode}';`,
          (err, post) => {
            if (err) {
              console.log(err);
            } else {
              if (!post.PostExists) {
                console.log(
                  `Inserting new post ${postInfo.shortcode} for user ${userId}...`
                );

                db.run(
                  "INSERT INTO Posts (ShortCode, UserId, Username, UserFullName, Url, ImageUrl, Caption, LikesCount, Created, CreatedDate, CreatedTime, HashtagSearch, IsVideo, VideoViewCount, VideoUrl, TrackingToken, TakenAt, Complete, MetadataUpdate, Error, Chunk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
                    null, // HashtagSearch
                    postInfo.isVideo,
                    postInfo.videoViewCount,
                    postInfo.videoUrl,
                    postInfo.trackingToken,
                    postInfo.takenAt,
                    0,
                    1,
                    null,
                    "J3"
                  ]
                  //, error => {
                  //   console.log("insert failed", error);
                  //   console.log(
                  //     postInfo,
                  //     dateTime.format("YYYY-MM-DD"),
                  //     dateTime.format("HH:mm:ss")
                  //   );
                  // }
                );
              } else {
                console.log(
                  `Updating existing post ${postInfo.shortcode} for user ${userId}...`
                );
                db.run(
                  `UPDATE Posts SET Username = ?, 
                                    UserFullName = ?, Caption = ?,
                                    LikesCount = ?, CreatedDate = ?,
                                    CreatedTime = ?, IsVideo = ?,
                                    VideoViewCount = ?, VideoUrl = ?, TrackingToken = ?, TakenAt = ?, MetadataUpdate = 1 WHERE Shortcode = ?`,
                  [
                    postInfo.username,
                    postInfo.userFullName,
                    postInfo.caption,
                    postInfo.likesCount,
                    dateTime.format("YYYY-MM-DD"),
                    dateTime.format("HH:mm:ss"),
                    postInfo.isVideo,
                    postInfo.videoViewCount,
                    postInfo.videoUrl,
                    postInfo.trackingToken,
                    postInfo.takenAt,
                    postInfo.shortcode
                  ]
                );
              }
            }
          }
        );
      }

      await deleteResumeData(userId, "Metadata", endCursor);

      if (pageInfo.has_next_page) {
        await getPostData(userId, true, pageInfo.end_cursor);
      }
    } catch (error) {
      // FD...
      console.log(error);
      console.log(`Waiting for 300 secs, due to http error...`);
      sleep.sleep(300);
      await getPostData(userId, hasNextPage, endCursor);
    }
  }
};

start();
