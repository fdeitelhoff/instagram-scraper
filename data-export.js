const fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database("./data/db.instagram");

const start = async function() {
  console.log(`Start data export for author -> post -> post references`);

  db.all(
    "SELECT Username, Shortcode, Caption FROM Posts WHERE Complete = 1 AND HashtagSearch = 'sokofuture' AND Caption IS NOT NULL AND Caption <> '';",
    async (err, posts) => {
      if (err) {
        console.log(err);
      } else {
        getRefPoster(posts);

        getRefHashtags(posts);
      }
    }
  );

  function getRefPoster(posts) {
    const regex = /\s(@[a-z.0-9_-]+)\s/gim;

    clearData("./data/author_post_refpost.csv");

    saveData("./data/author_post_refpost.csv", "Author;Post;RefPoster");

    for (const post of posts) {
      console.log(`Processing post ${post.Shortcode}...`);

      if ((m = regex.exec(post.Caption) === null)) {
        console.log(`Saving non-match for post ${post.Shortcode}...`);

        saveData(
          "./data/author_post_refpost.csv",
          `${post.Username};${post.Shortcode};-`
        );
      }

      while ((m = regex.exec(post.Caption)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
          regex.lastIndex++;
        }

        console.log(`Saving match for post ${post.Shortcode}...`);

        saveData(
          "./data/author_post_refpost.csv",
          `${post.Username};${post.Shortcode};${m[1]}`
        );
      }
    }
  }

  function getRefHashtags(posts) {
    const regex = /\s(#[a-z0-9_-]+)\s/gim;

    clearData("./data/author_post_refhashtags.csv");

    saveData("./data/author_post_refhashtags.csv", "Author;Post;Hashtag");

    for (const post of posts) {
      console.log(`Processing post ${post.Shortcode}...`);

      if ((m = regex.exec(post.Caption) === null)) {
        console.log(`Saving non-match for post ${post.Shortcode}...`);

        saveData(
          "./data/author_post_refhashtags.csv",
          `${post.Username};${post.Shortcode};-`
        );
      }

      while ((m = regex.exec(post.Caption)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
          regex.lastIndex++;
        }

        console.log(`Saving match for post ${post.Shortcode}...`);

        saveData(
          "./data/author_post_refhashtags.csv",
          `${post.Username};${post.Shortcode};${m[1]}`
        );
      }
    }
  }

  function saveData(file, row) {
    fs.appendFileSync(file, `${row}\n`);
  }

  function clearData(file) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
};

start();
