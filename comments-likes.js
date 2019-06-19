const fs = require("fs");
const axios = require("axios");
const sleep = require("sleep");
const moment = require("moment");
var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database("./data/db.instagram");
let commentCount = 0;
let likeCount = 0;

const start = async function(purgeData) {
  const proxies = [];
  // proxies.push({ host: '117.191.11.101', port: 80 });
  //   proxies.push({ host: "59.153.100.84", port: 80 });
  // proxies.push({ host: '185.132.133.180', port: 8080 });
  proxies.push({
    host: "45.32.152.77",
    port: 30981,
    user: "Dvuhvm",
    password: "1esHKx"
  });

  console.log("Starting scraping comments and likes for posts...");

  if (purgeData) {
    console.log("Purging data due to command line argument...");

    if (fs.existsSync("./data/dataset_post_comments.csv")) {
      fs.unlinkSync("./data/dataset_post_comments.csv");
    }

    if (fs.existsSync("./data/dataset_post_likes.csv")) {
      fs.unlinkSync("./data/dataset_post_likes.csv");
    }

    if (fs.existsSync("./data/processed_shortcodes.csv")) {
      fs.unlinkSync("./data/processed_shortcodes.csv");
    }

    fs.appendFileSync(
      "./data/dataset_post_comments.csv",
      `username;shortcode;commentCount;commentCountWithAnswers;comment_id;text;created_at;ownerId;ownerUsername\n`
    );

    fs.appendFileSync(
      "./data/dataset_post_likes.csv",
      `username;shortcode;likedByCount;ownerId;username;full_name\n`
    );

    fs.appendFileSync("./data/processed_shortcodes.csv", `shortcode\n`);
  }

  let i = 1;
  let posts = [];
  let resume = {};
  db.get(
    "SELECT Shortcode, Type, EndCursor FROM Resume ORDER BY Timestamp DESC LIMIT 1;",
    (err, results) => {
      if (err) {
        console.log(err);
      } else {
        resume = results;

        if (resume) {
          resumeData();
        } else {
          db.all(
            "SELECT Shortcode, UserId, Username, UserFullName, Url, ImageUrl, LikesCount, Timestamp, Complete FROM Posts WHERE Complete = 0;",
            (err, results) => {
              if (err) {
                console.log(err);
              } else {
                // console.log(results);
                posts = results;

                start();
              }
            }
          );
        }
      }
    }
  );

  async function resumeData() {
    db.get(
      `SELECT Shortcode, UserId, Username, UserFullName, Url, ImageUrl, LikesCount, Timestamp, Complete FROM Posts WHERE Shortcode = "${
        resume.Shortcode
      }" AND Complete = 0;`,
      (err, results) => {
        if (err) {
          console.log(err);
        } else {
          if (results) {
            const postInfo = results;
            startResumeData(postInfo);
          } else {
            console.log(`Post for shortcode ${resume.Shortcode} not found...`);

            db.all(
              "SELECT Shortcode, UserId, Username, UserFullName, Url, ImageUrl, LikesCount, Timestamp, Complete FROM Posts WHERE Complete = 0;",
              (err, results) => {
                if (err) {
                  console.log(err);
                } else {
                  // console.log(results);
                  posts = results;

                  start();
                }
              }
            );
          }
        }
      }
    );
  }

  async function startResumeData(postInfo) {
    console.log(
      `Resuming Shortcode ${resume.Shortcode} for Type ${
        resume.Type
      } with End Cursor ${resume.EndCursor}`
    );

    if (resume.Type === "Comments") {
      const commentProxy =
        proxies[randomIntFromInterval(0, proxies.length - 1)];
      console.log(`Using Proxy ${commentProxy.host}...`);
      await getComments(commentProxy, postInfo, true, resume.EndCursor);
    } else if (resume.Type === "Likes") {
      const likeProxy = proxies[randomIntFromInterval(0, proxies.length - 1)];
      console.log(`Using Proxy ${likeProxy.host}...`);
      await getLikes(likeProxy, postInfo, true, resume.EndCursor);
    }

    console.log(`Updating status for post ${postInfo.Shortcode}...`);
    db.run(
      `UPDATE Posts SET Complete = 1 WHERE Shortcode = "${postInfo.Shortcode}"`
    );

    console.log(
      `Resuming done... deleting resume info and start scraping again...`
    );
    // db.run(`DELETE FROM Resume WHERE Shortcode = "${postInfo.Shortcode}`);

    db.all(
      "SELECT Shortcode, UserId, Username, UserFullName, Url, ImageUrl, LikesCount, Timestamp, Complete FROM Posts WHERE Complete = 0;",
      (err, results) => {
        if (err) {
          console.log(err);
        } else {
          // console.log(results);
          posts = results;

          deleteResumeData(resume.Shortcode, resume.Type, resume.EndCursor);
          resume = undefined; // FD: For the safety... accessing should result in an error.

          start();
        }
      }
    );
  }

  async function start() {
    console.log(`${posts.length} posts found...`);

    for (const post of posts) {
      console.log(`Getting data for post ${post.Shortcode}...`);

      // FD: Getting a random proxy.
      const commentProxy =
        proxies[randomIntFromInterval(0, proxies.length - 1)];
      console.log(`Using Proxy ${commentProxy.host}...`);
      await getComments(commentProxy, post);

      // FD: Randomly waiting...
      if (i % 3 == 0) {
        const sleeping = randomIntFromInterval(120, 240);
        console.log(`Waiting for ${sleeping} secs...`);
        sleep.sleep(sleeping);
        i = 0;
      } else {
        const sleeping = randomIntFromInterval(3, 6);
        console.log(`Waiting for ${sleeping} secs...`);
        sleep.sleep(sleeping);
      }

      console.log(`Getting likes for post ${post.Shortcode}...`);

      // FD: Getting a random proxy.
      const likeProxy = proxies[randomIntFromInterval(0, proxies.length - 1)];
      console.log(`Using Proxy ${likeProxy.host}...`);
      await getLikes(likeProxy, post);

      //   saveData(postInfo);
      console.log(`Updating status for post ${post.Shortcode}...`);
      db.run(
        `UPDATE Posts SET Complete = 1 WHERE Shortcode = "${post.Shortcode}"`
      );
      i++;
    }
  }

  async function getComments(
    proxy,
    postInfo,
    hasNextPage = false,
    endCursor = ""
  ) {
    commentCount++;

    // FD: Randomly waiting...
    let sleeping = 0;
    if (commentCount % 30 === 0) {
      sleeping = randomIntFromInterval(10, 20);
      commentCount = 0;
      console.log(`Waiting for ${sleeping} secs...`);
    } else {
      sleeping = 0; // randomIntFromInterval(1, 2);
    }
    sleep.sleep(sleeping);

    // FD: How many elements should be selected (randomly).
    const firstElements = 50; // randomIntFromInterval(30, 50);

    let url = "";
    if (!hasNextPage) {
      url = `https://www.instagram.com/graphql/query/?query_hash=97b41c52301f77ce508f55e66d17620e&variables={"shortcode":"${
        postInfo.Shortcode
      }","first":${firstElements}}`;
    } else {
      url = `https://www.instagram.com/graphql/query/?query_hash=97b41c52301f77ce508f55e66d17620e&variables={"shortcode":"${
        postInfo.Shortcode
      }","first":${firstElements},"after":"${endCursor}"}`;
    }

    try {
      await createResumeData(postInfo.Shortcode, "Comments", endCursor);

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

      const data =
        response.data.data.shortcode_media.edge_media_to_parent_comment;
      hasNextPage = data.page_info.has_next_page;

      console.log(
        `(${sleeping}s): Getting next ${data.edges.length} comments for post ${
          postInfo.Shortcode
        }...`
      );

      for (const edge of data.edges) {
        const comment = {
          id: edge.node.id,
          text: edge.node.text,
          created_at: edge.node.created_at,
          ownerId: edge.node.owner.id,
          ownerUsername: edge.node.owner.username
        };

        var dateTime = moment.unix(comment.created_at);

        db.run(
          "INSERT INTO Comments (Shortcode, PostUsername, CommentId, Text, Created, CreatedDate, CreatedTime, UserId, Username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            postInfo.Shortcode,
            postInfo.Username,
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

      await deleteResumeData(postInfo.Shortcode, "Comments", endCursor);

      if (data.page_info.has_next_page) {
        await getComments(
          proxy,
          postInfo,
          hasNextPage,
          data.page_info.end_cursor
        );
      }
    } catch (error) {
      // FD...
      console.log(error);
      console.log(`Waiting for 300 secs, due to http error...`);
      sleep.sleep(300);
      await getComments(proxy, postInfo, hasNextPage, endCursor);
    }
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

  async function getLikes(
    proxy,
    postInfo,
    hasNextPage = false,
    endCursor = ""
  ) {
    likeCount++;

    // FD: Randomly waiting...
    let sleeping = 0;
    if (likeCount % 30 === 0) {
      sleeping = randomIntFromInterval(10, 20);
      likeCount = 0;
      console.log(`Waiting for ${sleeping} secs...`);
    } else {
      sleeping = 0; // randomIntFromInterval(1, 2);
    }

    sleep.sleep(sleeping);

    // FD: How many elements should be selected (randomly).
    const firstElements = 50; // randomIntFromInterval(30, 50);

    let url = "";
    if (!hasNextPage) {
      url = `https://www.instagram.com/graphql/query/?query_hash=d5d763b1e2acf209d62d22d184488e57&variables={"shortcode":"${
        postInfo.Shortcode
      }","first":${firstElements}}`;
    } else {
      url = `https://www.instagram.com/graphql/query/?query_hash=d5d763b1e2acf209d62d22d184488e57&variables={"shortcode":"${
        postInfo.Shortcode
      }","first":${firstElements},"after":"${endCursor}"}`;
    }

    try {
      await createResumeData(postInfo.Shortcode, "Likes", endCursor);

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

      if (response.data.data === undefined) {
        while (response.data.data === undefined) {
          console.log(
            `Sleeping 3 secs to ensure data is available (weired error!)...`
          );
          console.dir(response.data);
          console.log(JSON.stringify(response.data));
          sleep.sleep(3);
        }
      }
      const data = response.data.data.shortcode_media.edge_liked_by;

      console.log(
        `(${sleeping}s): Getting next ${data.edges.length} likes for post ${
          postInfo.Shortcode
        }...`
      );

      for (const edge of data.edges) {
        const like = {
          id: edge.node.id,
          username: edge.node.username,
          fullName: edge.node.full_name
        };

        db.run(
          "INSERT INTO Likes (Shortcode, PostUsername, UserId, Username, UserFullName) VALUES (?, ?, ?, ?, ?, ?)",
          [
            postInfo.Shortcode,
            postInfo.Username,
            like.id,
            like.username,
            like.fullName
          ]
        );
      }

      await deleteResumeData(postInfo.Shortcode, "Likes", endCursor);

      if (data.page_info.has_next_page) {
        await getLikes(
          proxy,
          postInfo,
          data.page_info.has_next_page,
          data.page_info.end_cursor
        );
      }
    } catch (error) {
      // FD...
      console.log(error);
      console.log(`Waiting for 300 secs, due to http error...`);
      sleep.sleep(300);
      await getLikes(proxy, postInfo, hasNextPage, endCursor);
    }
  }

  function randomIntFromInterval(min, max) {
    // min and max included
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
};

// FD: Will be messed up with other arguments...
const purgeData = process.argv[2] ? true : false;

start(purgeData);
