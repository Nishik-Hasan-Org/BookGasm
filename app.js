import express from "express";
import pg from "pg"
import env from "dotenv";
import bcrypt from "bcrypt";
import passport from "passport"; 
import { Strategy } from "passport-local";
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
async function getBooks(searchQuery = "") {
  books = []       //resets the books
  let result;
  try {
    if (searchQuery.length > 0) {  //checks for any search
      result = await db.query(
        "SELECT * FROM books WHERE title ILIKE $1",
        [`%${searchQuery}%`]
      );
    } else {
      result = await db.query("SELECT * FROM books");
    }
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}
app.get("/",async(req,res)=>{
  res.render("home.ejs");
});
// ✅ Route to handle both default and search
app.get("/books", async (req, res) => {  //hits the books page
  if(req.isAuthenticated()){
  //Authenticate
  const searchQuery = req.query.q || "";
  books = await getBooks(searchQuery);
  let sort = req.query.sort;
  if(sort === 'rating'){
    const result = await db.query("SELECT * FROM books ORDER BY rating DESC ");
    books = result.rows;
  }
  if(sort === 'title'){
    const result = await db.query("SELECT * FROM books ORDER BY title ASC ");
    books = result.rows;
  }
  res.render("index.ejs", {
    query: searchQuery,
    books: books,
    sort: sort
  });
}
else{
  res.send("<h1> Not Authenticated</h1>")
}
});

app.get('/add',(req,res)=>{ //renders the add page
  
  res.render("book-form.ejs");
});

app.post('/add',async(req,res)=>{   //add route

 try{ 
   
    const { id, title, author, summary, link, rating } = req.body;
  const result = await db.query("SELECT * FROM books WHERE id = $1",[id]);
  
  if(result.rows.length >0){
         res.send(`<h1>${result}</h1>`)

}
  else{
    const image = `https://covers.openlibrary.org/b/isbn/${id}-M.jpg`;
  await db.query("INSERT INTO books (id,title,author,summary,image,link,rating) VALUES ($1,$2,$3,$4,$5,$6,$7) ",[id, title, author, summary, image, link, rating ]);
  res.redirect("/");
  }
}
  catch(err){
    console.log(err);
  }
})

app.post('/delete/:id', async(req,res)=>{  //deleting books via id
    try{
      console.log(req.params.id);
        await db.query("DELETE FROM books WHERE id = $1",[req.params.id]);
        res.redirect("/");
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
    failureRedirect: "/homw",
  })
)
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
          console.log(profile);
          const result = await db.query("SELECT * FROM users WHERE email = $1", [profile.email,]);
          if(result.rows.length === 0){
            const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "google"]
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
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});


app.listen(port, ()=>{
  console.log(`BookGasm running at http://localhost:${port}`);
})