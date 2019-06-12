const fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database("./data/db.instagram");
let rawdata = fs.readFileSync("./data/dataset_posts.json");
let posts = JSON.parse(rawdata);

console.log(`${posts.length} posts found...`);

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

  console.log(`Saving post ${postInfo.shortcode} into the database...`);

  db.run(
    "INSERT INTO Posts (ShortCode, UserId, Username, UserFullName, Url, ImageUrl, LikesCount, Timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      postInfo.shortcode,
      postInfo.userid,
      postInfo.username,
      postInfo.userFullName,
      postInfo.url,
      postInfo.imageUrl,
      postInfo.likesCount,
      postInfo.timestamp
    ]
  );
}

let processedShortcodes = [];
let shortcodes = "";

if (fs.existsSync("./data/processed_shortcodes.csv")) {
  const data = fs.readFileSync("./data/processed_shortcodes.csv", "utf8");
  processedShortcodes = data.trim().match(/[^\r\n]+/g);
  processedShortcodes.shift();
  shortcodes = processedShortcodes.join('", "');
  shortcodes = '"' + shortcodes + '"';

  console.log(
    `Updating already processed shortcodes (${processedShortcodes.length})...`
  );
}

db.run(`UPDATE Posts SET Complete = 1 WHERE Shortcode IN (${shortcodes})`);

db.close();

// CREATE TABLE Posts(
//     Shortcode    STRING  NOT NULL
//                          PRIMARY KEY,
//     UserId       BIGINT  NOT NULL,
//     Username     STRING  NOT NULL,
//     UserFullName STRING  NOT NULL,
//     Url          STRING  NOT NULL,
//     ImageUrl     STRING  NOT NULL,
//     LikesCount   INTEGER NOT NULL,
//     Timestamp    STRING  NOT NULL
// );

// db.run('CREATE ');
