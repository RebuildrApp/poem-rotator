const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const port = process.env.PORT || 8080;

// Strip sslmode from the connection string so the pg library doesn't
// override our ssl config with verify-full behavior.
const dbUrl = (process.env.DATABASE_URL || "").replace(/[?&]sslmode=[^&]*/g, "");

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS poems (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        body TEXT NOT NULL
      )
    `);

    const { rows } = await client.query("SELECT COUNT(*) AS count FROM poems");
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO poems (title, author, body) VALUES
        (
          'The Road Not Taken',
          'Robert Frost',
          E'Two roads diverged in a yellow wood,\nAnd sorry I could not travel both\nAnd be one traveler, long I stood\nAnd looked down one as far as I could\nTo where it bent in the undergrowth;\n\nThen took the other, as just as fair,\nAnd having perhaps the better claim,\nBecause it was grassy and wanted wear;\nThough as for that the passing there\nHad worn them really about the same,\n\nAnd both that morning equally lay\nIn leaves no step had trodden black.\nOh, I kept the first for another day!\nYet knowing how way leads on to way,\nI doubted if I should ever come back.\n\nI shall be telling this with a sigh\nSomewhere ages and ages hence:\nTwo roads diverged in a wood, and I—\nI took the one less traveled by,\nAnd that has made all the difference.'
        ),
        (
          'Hope is the thing with feathers',
          'Emily Dickinson',
          E'Hope is the thing with feathers\nThat perches in the soul,\nAnd sings the tune without the words,\nAnd never stops at all,\n\nAnd sweetest in the gale is heard;\nAnd sore must be the storm\nThat could abash the little bird\nThat kept so many warm.\n\nI''ve heard it in the chillest land,\nAnd on the strangest sea;\nYet, never, in extremity,\nIt asked a crumb of me.'
        ),
        (
          'Invictus',
          'William Ernest Henley',
          E'Out of the night that covers me,\nBlack as the pit from pole to pole,\nI thank whatever gods may be\nFor my unconquerable soul.\n\nIn the fell clutch of circumstance\nI have not winced nor cried aloud.\nUnder the bludgeonings of chance\nMy head is bloody, but unbowed.\n\nBeyond this place of wrath and tears\nLooms but the Horror of the shade,\nAnd yet the menace of the years\nFinds and shall find me unafraid.\n\nIt matters not how strait the gate,\nHow charged with punishments the scroll,\nI am the master of my fate,\nI am the captain of my soul.'
        )
      `);
      console.log("Seeded 3 poems into the database.");
    }
  } finally {
    client.release();
  }
}

app.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM poems ORDER BY id");
    const poems = rows;
    if (poems.length === 0) {
      return res.send("No poems found.");
    }

    // Rotate based on current minute so each visitor in the same minute sees the same poem
    const index = Math.floor(Date.now() / 60000) % poems.length;
    const poem = poems[index];

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Poem of the Moment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: Georgia, 'Times New Roman', serif;
      padding: 2rem;
    }
    .card {
      max-width: 600px;
      background: #16213e;
      border: 1px solid #0f3460;
      border-radius: 12px;
      padding: 2.5rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 1.8rem;
      color: #e94560;
      margin-bottom: 0.3rem;
    }
    .author {
      font-style: italic;
      color: #a0a0b0;
      margin-bottom: 1.5rem;
      font-size: 1.1rem;
    }
    .body {
      white-space: pre-line;
      line-height: 1.8;
      font-size: 1.1rem;
    }
    .hint {
      margin-top: 2rem;
      font-size: 0.85rem;
      color: #555;
      text-align: center;
    }
  </style>
  <meta http-equiv="refresh" content="60">
</head>
<body>
  <div class="card">
    <h1>${poem.title}</h1>
    <div class="author">by ${poem.author}</div>
    <div class="body">${poem.body}</div>
    <div class="hint">Poem rotates every minute. Showing ${index + 1} of ${poems.length}.</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong.");
  }
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Poem Rotator running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
