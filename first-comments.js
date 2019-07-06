const fs = require("fs");
const moment = require("moment");
var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database("./data/db.instagram");

const start = async function() {
  let rawdata = fs.readFileSync("./data/dataset_posts.json");
  let posts = JSON.parse(rawdata);

  console.log(`${posts.length} posts found...`);

  let commentId = 0;
  for (const post of posts) {
    const postInfo = {
      shortcode: post["#debug"].shortcode,
      userid: post["#debug"].userId,
      username: post["#debug"].userUsername,
      userFullName: post["#debug"].userFullName,
      url: post.url,
      imageUrl: post.imageUrl,
      likesCount: post.likesCount,
      timestamp: post.timestamp
    };

    console.log(
      `Saving first comment for post ${postInfo.shortcode} into the database...`
    );

    const comment = {
      id: ++commentId,
      text: post.firstComment,
      created_at: postInfo.timestamp,
      ownerId: postInfo.userid,
      ownerUsername: postInfo.username
    };

    var dateTime = moment.unix(comment.created_at);

    if (comment.text !== undefined) {
      db.run(
        "INSERT INTO Comments (Shortcode, PostUsername, CommentId, Text, Created, CreatedDate, CreatedTime, UserId, Username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          postInfo.shortcode,
          postInfo.username,
          comment.id,
          comment.text,
          comment.created_at,
          dateTime.format("YYYY-MM-DD"),
          dateTime.format("HH:mm:ss"),
          comment.ownerId,
          comment.ownerUsername
        ]
      );
    }
  }
};

start();
