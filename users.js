const fs = require("fs");
const axios = require("axios");
const sleep = require("sleep");
var HTMLParser = require("node-html-parser");
var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database("./data/db.instagram");

const start = async function(category) {
  // FD: This will be improved....
  let tableName = "";
  if (category === "posts") {
    tableName = "Posts";
  } else if (category === "comments") {
    tableName = "Comments";
  } else if (category === "likes") {
    tableName = "Likes";
  }

  db.all(
    `SELECT DISTINCT UserId, Username FROM ${tableName} WHERE not exists(SELECT 1 FROM Users WHERE Users.UserId = ${tableName}.UserId);`,
    (err, users) => {
      if (err) {
        console.log(err);
      } else {
        // console.log(users);
        scrapUserData(users);
      }
    }
  );

  let userCount = 0;
  async function scrapUserData(users) {
    for (const user of users) {
      userCount++;
      
      console.log(
        `Getting user data for user ${user.Username} (${user.UserId})`
      );

      if (userCount % 20 === 0) {
        sleep.sleep(20);
        console.log(`Sleeping for 20 seconds...`);
        userCount = 1;
      }

      const url = `https://www.instagram.com/${user.Username}`;
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
          scriptData = scriptTag.rawText
            .replace("window._sharedData = ", "")
            .replace(";", "");
        }
      }

      const data = JSON.parse(scriptData);
      const userData = data.entry_data.ProfilePage[0].graphql.user;

      await writeData(user, userData);
    }
  }

  async function writeData(currentUser, userData) {
    try {
      db.get(
        `SELECT Count(1) as UserExists FROM Users WHERE UserId = ${
        currentUser.UserId
        };`,
        (err, user) => {
          if (err) {
            console.log(err);
          } else {
            if (!user.UserExists) {
              db.run(
                "INSERT INTO Users (UserId, Username, UsernameChange, Fullname, Biography, ExternalUrl, ProfilePicUrl, ProfilePicUrlHd, FollowedBy, Following, ConnectedFbPage) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
                [
                  currentUser.UserId,
                  currentUser.Username,
                  userData.username,
                  userData.full_name,
                  userData.biography,
                  userData.external_url,
                  userData.profile_pic_url,
                  userData.profile_pic_url_hd,
                  userData.edge_followed_by.count,
                  userData.edge_follow.count,
                  userData.connected_fb_page
                ]
              );
            }
          }
        }
      );
    } catch (error) {
      fs.appendFileSync(
        "./data/user_scraping_errors.txt",
        `Error while scraping user data for ${currentUser.Username} (${
        currentUser.UserId
        }): Error\n${error}\n\n`
      );
    }
  }
};

// FD: Getting the one and only cmd parameter.
const category = process.argv[2] ? process.argv[2] : "all";

if (category === "all") {
  console.log("The category 'all' is not supported right now...");
  return;
}

start(category);
