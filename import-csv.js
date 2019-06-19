const fs = require("fs");
var sqlite3 = require("sqlite3").verbose();
const moment = require("moment");

console.log(`Everything should be imported at the moment...`);
return;

var db = new sqlite3.Database("./data/db.instagram");

// FD: Getting the one and only cmd parameter.
const category = process.argv[2] ? process.argv[2] : "all";

if (category === "comments") {
  console.log(`Importing Comments...`);

  let rawdata = fs.readFileSync("./data/dataset_post_comments.csv", {
    encoding: "UTF8"
  });

  const lines = rawdata.split("\n");
  lines.shift(); // FD: Remove header.

  console.log(`${lines.length} comments found...`);

  let index = 1;
  for (const line of lines) {
    const columns = line.trim().split(";");

    var dateTime = moment.unix(columns[6]);

    console.log(`Importing comment ${index}...`);

    db.run(
      "INSERT INTO Comments (Shortcode, PostUsername, Comments, CommentsWithAnswers, CommentId, Text, Created, CreatedDate, CreatedTime, UserId, Username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        columns[1],
        columns[0],
        0,
        0,
        columns[4],
        columns[5],
        columns[6],
        dateTime.format("YYYY-MM-DD"),
        dateTime.format("HH:mm:ss"),
        columns[7],
        columns[8]
      ]
    );

    index++;
  }
} else if (category === "likes") {
  console.log(`Importing Likes...`);

  let rawdata = fs.readFileSync("./data/dataset_post_likes.csv", {
    encoding: "UTF8"
  });

  const lines = rawdata.split("\n");
  lines.shift(); // FD: Remove header.

  console.log(`${lines.length} likes found...`);

  let index = 1;
  for (const line of lines) {
    const columns = line.trim().split(";");

    console.log(`Importing like ${index}...`);

    db.run(
      "INSERT INTO Likes (Shortcode, PostUsername, PostLikes, UserId, Username, UserFullName) VALUES (?, ?, ?, ?, ?, ?)",
      [columns[1], columns[0], columns[2], columns[3], columns[4], columns[5]]
    );

    index++;
  }
}
