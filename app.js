import express from "express";
import pg from "pg"
import env from "dotenv";
import bcrypt from "bcrypt";
import passport from "passport"; 
import { Strategy as LocalStrategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
env.config();
// console.log(" DB_USER:", process.env.DB_USER);
// console.log("DB_PASSWORD:", process.env.DB_PASSWORD);
// console.log("Type of password:",  process.env.GOOGLE_CLIENT_ID); // should be 'string'

const app = express();
const port = 3000;
let books = [];
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Secret for encrypting the session
    resave: false,
    saveUninitialized: true,
       cookie: {
      maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    }
  })
);
app.use(express.urlencoded({ extended: true }));  //giving the requests the body
app.use(express.static("public"));

app.use(passport.initialize());    // Initialize passport
app.use(passport.session());       // Use sessions with passport

const db = new pg.Client({ // connecting to database
user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: (process.env.DB_PASSWORD),
  port: process.env.DB_PORT,

});
db.connect();

// ✅ getBooks Function
async function getBooks(searchQuery = "", userId) {
  books = []       //resets the books
  let result;
  try {
    if (searchQuery.length > 0) {  //checks for any search
 result = await db.query(
        "SELECT * FROM books WHERE user_id = $1 AND title ILIKE $2",
        [userId, `%${searchQuery}%`]
      );
    } else {
      result = await db.query("SELECT * FROM books WHERE user_id = $1",[userId]);
    }
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}
app.get("/",async(req,res)=>{ //homepage
  res.render("home.ejs");
});
app.get("/register",async(req,res)=>{//signup page
  res.render("register.ejs");
})
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    console.log(req.body);
    console.log(password);

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, hashedPassword]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error registering user");
  }
});
// ✅ Route to handle both default and search
app.get("/books", async (req, res) => {
  if (req.isAuthenticated()) {
    const searchQuery = req.query.q || "";
    const userId = req.user.user_id;
    books = await getBooks(searchQuery, userId);

    const sort = req.query.sort;
    if (sort === "rating") {
      const result = await db.query(
        "SELECT * FROM books WHERE user_id = $1 ORDER BY rating DESC",
        [userId]
      );
      books = result.rows;
    } else if (sort === "title") {
      const result = await db.query(
        "SELECT * FROM books WHERE user_id = $1 ORDER BY title ASC",
        [userId]
      );
      books = result.rows;
    }

    res.render("index.ejs", {
      query: searchQuery,
      books: books,
      sort: sort
    });
  } else {
    res.send("<h1> Not Authenticated</h1>");
  }
});

app.get('/add',(req,res)=>{ //renders the add page

  res.render("book-form.ejs");
});

app.post('/add',async(req,res)=>{   //add route
     

 try{ 
    console.log(req.body)
    const { id, title, author, summary, link, rating } = req.body;
  const result = await db.query("SELECT * FROM books WHERE id = $1",[id]);
  console.log(req.body);
  if(result.rows.length >0){
         res.send(`<h1>${result}</h1>`)

}
  else{
    const image = `https://covers.openlibrary.org/b/isbn/${id}-M.jpg`;
  await db.query(
        "INSERT INTO books (id, title, author, summary, image, link, rating, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [id, title, author, summary, image, link, rating, req.user.user_id]
      );

  res.redirect("/books");
  }
}
  catch(err){
    console.log(err);
  }
})

app.post('/delete/:id', async(req,res)=>{  //deleting books via id
    try{
      console.log(req.params.id);
        await db.query("DELETE FROM books WHERE id = $1 && user_id = $2",[req.params.id,req.user.user_id]);
        res.redirect("/books");
    }
    catch(err){
      console.log(err.stack);
    }
})
app.get("/auth/google",
    passport.authenticate("google", {
    scope: ["profile", "email"],
  })  
);
app.get("/auth/google/books",
   passport.authenticate("google", {
    successRedirect: "/books",
    failureRedirect: "/",
  })
  
)
app.post('/', 
  passport.authenticate('local', {
    successRedirect: '/books',
    failureRedirect: '/',
  })
);
passport.use(new LocalStrategy(
  async function(username, password, done) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
      const user = result.rows[0];

      if (!user) {
        return done(null, false, { message: "Incorrect username." });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: "Incorrect password." });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.use("google",
    new GoogleStrategy( 
      {
        clientID : process.env.GOOGLE_CLIENT_ID,
        clientSecret : process.env.GOOGLE_CLIENT_SECRET,
         callbackURL: "http://localhost:3000/auth/google/books",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      },
      async (accessToken, refreshToken, profile, cb)=>{
        try{
          // console.log(profile);
          const result = await db.query("SELECT * FROM users WHERE email = $1", [profile.email,]);
          if(result.rows.length === 0){
            const newUser = await db.query(
            "INSERT INTO users (email) VALUES ($1)",
            [profile.email]
          );
           return cb(null, result.rows[0]);
        }
        else{
           return cb(null, result.rows[0]);
        }
        }catch(err){
          cb(err);
        }
      }
    )
);

passport.serializeUser((user, cb) => {
  cb(null, user.user_id);
});

passport.deserializeUser(async (id, cb) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE user_id = $1", [id]);
    if (result.rows.length > 0) {
      cb(null, result.rows[0]); // pass the full user object to req.user
    } else {
      cb(new Error("User not found"));
    }
  } catch (err) {
    cb(err);
  }
});

app.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});
app.listen(port, ()=>{
  console.log(`BookGasm running at http://localhost:${port}`);
})