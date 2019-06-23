const fs = require("fs");
const axios = require("axios");
const sleep = require("sleep");
const moment = require("moment");
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

      const dateTime = moment();

      console.log(
        `${dateTime.format(
          "DD.MM.YYYY, HH:mm:ss"
        )} - Getting user data for user ${user.Username} (${user.UserId})`
      );

      if (userCount % 50 === 0) {
        const sleeping = 5;
        console.log(`Sleeping for ${sleeping} seconds...`);
        sleep.sleep(sleeping);
        userCount = 1;
      }

      let userData = {};
      try {
        const checkUserUrl = `https://www.instagram.com/graphql/query/?query_hash=aec5501414615eca36a9acf075655b1e&variables={"user_id":"${user.UserId}","include_chaining":true,"include_reel":true,"include_suggested_users":false,"include_logged_out_extras":false,"include_highlight_reels":false}`;
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

        // FD: Use the username we got with the previous request. This is probably newer!
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

        await writeData(user, userData);
      } catch (error) {
        userData.Error = (error.response) ? error.response.status : error;
        userData.edge_followed_by = {};
        userData.edge_followed_by.count = 0;
        userData.edge_follow = {};
        userData.edge_follow.count = 0;
        await writeData(user, userData)
      }
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
                "INSERT INTO Users (UserId, Username, UsernameChange, Fullname, Biography, ExternalUrl, ProfilePicUrl, ProfilePicUrlHd, FollowedBy, Following, ConnectedFbPage, Error) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
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
                  userData.connected_fb_page,
                  userData.Error
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
